import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { pickPromptByContentType, getCategoryInstruction } from '@/lib/prompts/seo-prompts'
import { extractMetaFromContent } from '@/lib/wordpress/client'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

import { generateCardImage } from '@/lib/image/satori-generator'


// 이미지별 문구 세트 파싱
interface ImagePlan {
  title: string
  captions: string[]
}

function parseImagePlans(rawContent: string, fallbackTitle: string, fallbackCaps: string[]): ImagePlan[] {
  const planMatch = rawContent.match(/<!--\s*IMAGE_PLANS:\s*([\s\S]*?)\s*-->/)
  if (!planMatch) return []
  return planMatch[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split('|').map(s => s.trim()).filter(s => s.length > 0)
      const title = parts[0] || fallbackTitle
      const captions = parts.slice(1).filter(s => s.length >= 2 && !s.startsWith('['))
      return { title, captions: captions.length > 0 ? captions : fallbackCaps }
    })
}

// 레이아웃 0~10 중 중복 없이 Fisher-Yates 셔플로 균등 랜덤 배정
function pickLayouts(count: number): number[] {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  // Fisher-Yates 균등 셔플 (sort 기반은 편향 발생)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[i % pool.length])
  }
  return result
}

function cleanContentForPublish(content: string): string {
  return content
    .replace(/\[INTERNAL_LINK:\s*([^\]]+)\]/g, '')
    .replace(/<!--\s*IMG[\s\S]*?-->/g, '')
    .replace(/<!--\s*LSI_KEYWORDS[\s\S]*?-->/g, '')
    .replace(/<!--\s*SOCIAL_COPY[\s\S]*?-->/g, '')
    .replace(/\(IMG_CAPS[^)]*\)/g, '')
}

// 페르소나 폴백 프롬프트
const PERSONA_PROMPTS: Record<string, string> = {
  'P-01': 'You are Dr. Sarah Mitchell, a board-certified dermatologist with 15 years of clinical experience.',
}

/**
 * POST /api/preview
 * 글 생성 + 이미지를 base64로 삽입한 preview HTML 반환
 * + DB에 clean 콘텐츠 저장 → logId 반환 (발행 시 재사용)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      keyword, language, personaCode, siteId,
      contentType = 'informational',
      category,
      imageCount = 'random',
      imageCountMin = 1,
      imageCountMax = 8,
      seoDefaults = {} as {
        minWords?: number; maxWords?: number;
        keywordDensity?: string;
        includeDisclaimer?: boolean;
        includeSchema?: boolean;
      },
    } = body

    if (!keyword?.trim()) return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 })
    if (!siteId)           return NextResponse.json({ error: '사이트를 선택해주세요.' }, { status: 400 })

    const supabase = createServiceClient()

    // 사이트 + 페르소나 정보 로드
    const [{ data: siteData }, { data: personaData }] = await Promise.all([
      supabase.from('sites').select('*').eq('id', siteId).single(),
      supabase.from('personas').select('code, system_prompt, writing_style, name, title').eq('code', personaCode || 'P-01').single(),
    ])

    const systemPrompt = personaData?.system_prompt || PERSONA_PROMPTS[personaCode] || PERSONA_PROMPTS['P-01']
    const seoTemplate  = pickPromptByContentType(contentType)
    const categoryStr  = category || siteData?.category || 'health'
    // wordCount: seoDefaults 범위 내 랜덤, 없으면 1500
    const minW = seoDefaults?.minWords || 1500
    const maxW = seoDefaults?.maxWords || 2500
    const wordCount = minW + Math.floor(Math.random() * (maxW - minW))
    const density = seoDefaults?.keywordDensity ?? '1.5'
    const disclaimerLine = seoDefaults?.includeDisclaimer !== false
      ? `\n⚠️ 면책 조항을 본문 맨 아래에 반드시 포함: <p class="disclaimer"><strong>⚠️ 면책 조항:</strong> 이 글은 정보 제공 목적으로 작성되었으며, 전문적인 의료 조언을 대체하지 않습니다.</p>`
      : ''
    const schemaHint = seoDefaults?.includeSchema !== false ? '\n<!-- SCHEMA: Article -->' : ''

    // Claude로 글 생성
    const langInstruction =
      language === 'ko' ? '반드시 한국어로 작성하세요.' :
      language === 'ja' ? '必ず日本語で書いてください。' :
      'Write in English only.'

    const userPrompt = `${langInstruction}

키워드: "${keyword}"
카테고리: ${categoryStr}
목표 글자 수: ${wordCount}자 이상
키워드 밀도: ${density}% (기계적 반복 금지)

${seoTemplate.contentStructure}

[OUTPUT FORMAT - 코드블록 없이 HTML만 출력]
<!-- META: [150자 이하 메타디스크립션] -->
<!-- TITLE: [H1 제목] -->${schemaHint}
<!-- IMAGE_PLANS:
이미지1소제목(20자이내)|캡션A(15자이내)|캡션B(15자이내)|캡션C(15자이내)|캡션D(15자이내)|캡션E(15자이내)
이미지2소제목(20자이내)|캡션A(15자이내)|캡션B(15자이내)|캡션C(15자이내)|캡션D(15자이내)|캡션E(15자이내)
이미지3소제목(20자이내)|캡션A(15자이내)|캡션B(15자이내)|캡션C(15자이내)|캡션D(15자이내)|캡션E(15자이내)
이미지4소제목(20자이내)|캡션A(15자이내)|캡션B(15자이내)|캡션C(15자이내)|캡션D(15자이내)|캡션E(15자이내)
이미지5소제목(20자이내)|캡션A(15자이내)|캡션B(15자이내)|캡션C(15자이내)|캡션D(15자이내)|캡션E(15자이내)
이미지6소제목(20자이내)|캡션A(15자이내)|캡션B(15자이내)|캡션C(15자이내)|캡션D(15자이내)|캡션E(15자이내)
이미지7소제목(20자이내)|캡션A(15자이내)|캡션B(15자이내)|캡션C(15자이내)|캡션D(15자이내)|캡션E(15자이내)
이미지8소제목(20자이내)|캡션A(15자이내)|캡션B(15자이내)|캡션C(15자이내)|캡션D(15자이내)|캡션E(15자이내)
-->
규칙: 각 이미지 소제목과 캡션은 본문 핵심 내용 반영, 서로 다른 주제/관점, 한국어/영어/일본어 언어에 맞게 작성.
${disclaimerLine}

⚠️ 중요: 글은 반드시 결론 섹션(마무리/정리/요약)으로 완전히 끝나야 합니다. 내용이 중간에 잘리지 않도록 하고, 마지막에 면책 조항까지 포함하여 완결된 글을 작성하세요.

[<h1>으로 시작하는 전체 HTML 본문 — 반드시 결론/마무리 단락으로 완결]`

    const combinedSystem = [systemPrompt, seoTemplate.systemInstruction, getCategoryInstruction(categoryStr)]
      .filter(Boolean).join('\n\n---\n\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: combinedSystem,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawContent = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleanedContent = cleanContentForPublish(rawContent)
    const { title: extractedTitle, metaDescription } = extractMetaFromContent(cleanedContent)
    const finalTitle = extractedTitle || keyword
    const actualWordCount = cleanedContent.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length

    // IMAGE_PLANS 파싱 (이미지별 독립 문구 세트)
    const h2Texts = (cleanedContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [])
      .map(h => h.replace(/<[^>]+>/g, '').trim()).filter(t => t.length >= 4)
    const fallbackCaps = h2Texts.length > 0 ? h2Texts : [keyword]
    const imagePlans = parseImagePlans(rawContent, finalTitle, fallbackCaps)

    // 이미지 개수 결정
    let numImages: number
    if (imageCount === 'fixed') {
      numImages = Math.max(1, imageCountMin || 1)
    } else {
      const min = Math.max(1, imageCountMin || 1)
      const max = Math.min(8, imageCountMax || 8)
      numImages = min + Math.floor(Math.random() * (max - min + 1))
    }
    console.log(`🖼 미리보기 이미지 ${numImages}개 카드 생성 시작`)

    // 레이아웃 중복 없이 랜덤 배정
    const layouts = pickLayouts(numImages)

    // 이미지 생성 → base64 배열
    const base64Images: string[] = []

    for (let i = 0; i < numImages; i++) {
      const plan = imagePlans[i]
      const imgTitle = plan?.title ?? (h2Texts[i] ?? finalTitle)
      const imgCaptions = plan?.captions?.length > 0 ? plan.captions : fallbackCaps.slice(0, 5)

      // 카드뉴스 이미지 생성 (Satori)
      try {
        const buf = await generateCardImage({
          title: imgTitle, captions: imgCaptions,
          category: categoryStr, language,
          layout: layouts[i], variant: i,
          siteName: siteData?.name,
        })
        base64Images.push(`data:image/png;base64,${buf.toString('base64')}`)
        console.log(`✅ 이미지 ${i + 1}/${numImages} 완료 (layout=${layouts[i]}, title="${imgTitle.slice(0,15)}...")`)
      } catch (imgErr) {
        console.warn(`⚠️ 이미지 ${i + 1}/${numImages} 생성 실패`, imgErr)
      }
    }

    // H2 뒤에 이미지 삽입 (base64 data URL 사용)
    let previewContent = cleanedContent
    if (base64Images.length > 0) {
      // 첫 번째 이미지는 대표 이미지 (h1 바로 뒤)
      previewContent = previewContent.replace(
        /(<h1[^>]*>[\s\S]*?<\/h1>)/i,
        `$1\n<figure class="wp-block-image size-full" style="text-align:center;margin:16px 0"><img src="${base64Images[0]}" alt="${finalTitle} 이미지 1" style="max-width:100%;border-radius:8px" /></figure>\n`
      )
      // 나머지 이미지들: H2 뒤에 삽입
      if (base64Images.length > 1) {
        const imgTags = base64Images.slice(1).map((src, idx) =>
          `\n<figure class="wp-block-image size-full" style="text-align:center;margin:16px 0"><img src="${src}" alt="${finalTitle} 이미지 ${idx + 2}" style="max-width:100%;border-radius:8px" /></figure>\n`
        )
        const h2Regex = /<\/h2>/gi
        const h2Positions: number[] = []
        let h2Match
        while ((h2Match = h2Regex.exec(previewContent)) !== null) {
          h2Positions.push(h2Match.index + h2Match[0].length)
        }
        if (h2Positions.length > 0) {
          const chosen = h2Positions
            .sort(() => Math.random() - 0.5)
            .slice(0, imgTags.length)
            .sort((a, b) => b - a)
          chosen.forEach((pos, idx) => {
            previewContent = previewContent.slice(0, pos) + imgTags[idx] + previewContent.slice(pos)
          })
        }
      }
    }

    // DB에 클린 콘텐츠(이미지 없는 버전) 저장 → 발행 시 /api/publish/[id] 에서 이미지 새로 생성
    const { data: inserted, error: logError } = await supabase
      .from('publish_logs')
      .insert({
        site_id:         siteId,
        keyword_text:    keyword,
        title:           finalTitle,
        language,
        category:        categoryStr,
        word_count:      actualWordCount,
        image_count:     0,
        prompt_type:     seoTemplate.id,
        scheduled_at:    new Date().toISOString(),
        status:          'pending',
        claude_tokens:   message.usage.input_tokens + message.usage.output_tokens,
        content:         cleanedContent,
        meta_description: metaDescription || null,
        prompt_used:     JSON.stringify({ id: seoTemplate.id, name: seoTemplate.name }),
      })
      .select('id')
      .single()

    if (logError) console.warn('로그 저장 실패:', logError.message)

    return NextResponse.json({
      previewHtml: previewContent,  // base64 이미지 포함
      title: finalTitle,
      logId: inserted?.id || null,
      imageCount: base64Images.length,
    })

  } catch (error: unknown) {
    console.error('Preview API error:', error)
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
