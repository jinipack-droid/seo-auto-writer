import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { pickPromptByContentType, getCategoryInstruction } from '@/lib/prompts/seo-prompts'
import { extractMetaFromContent } from '@/lib/wordpress/client'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// image-server.mjs (localhost:3001) 호출 → Buffer 반환
async function generateCardImageBuffer(data: {
  title: string
  captions: string[]
  category: string
  language: string
  layout: number
  variant?: number
  siteName?: string
}): Promise<Buffer | null> {
  try {
    const res = await fetch('http://localhost:3001/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
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
    const wordCount    = 1500

    // Claude로 글 생성
    const langInstruction =
      language === 'ko' ? '반드시 한국어로 작성하세요.' :
      language === 'ja' ? '必ず日本語で書いてください。' :
      'Write in English only.'

    const userPrompt = `${langInstruction}

키워드: "${keyword}"
카테고리: ${categoryStr}
목표 글자 수: ${wordCount}자 이상

${seoTemplate.contentStructure}

[OUTPUT FORMAT - 코드블록 없이 HTML만 출력]
<!-- META: [150자 이하 메타디스크립션] -->
<!-- TITLE: [H1 제목] -->
<!-- SCHEMA: Article -->
<!-- IMG_CAPS: [캡션1]|[캡션2]|[캡션3]|[캡션4]|[캡션5]|[캡션6]|[캡션7]|[캡션8] -->

[<h1>으로 시작하는 전체 HTML 본문]`

    const combinedSystem = [systemPrompt, seoTemplate.systemInstruction, getCategoryInstruction(categoryStr)]
      .filter(Boolean).join('\n\n---\n\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: combinedSystem,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const rawContent = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleanedContent = cleanContentForPublish(rawContent)
    const { title: extractedTitle, metaDescription } = extractMetaFromContent(cleanedContent)
    const finalTitle = extractedTitle || keyword
    const actualWordCount = cleanedContent.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length

    // IMG_CAPS 파싱
    const capMatch = rawContent.match(/<!--\s*IMG_CAPS:\s*(.*?)\s*-->/)
    const parsedCaps = capMatch
      ? capMatch[1].split('|').map(s => s.trim()).filter(s => s.length >= 2 && !s.startsWith('['))
      : []
    const h2Fallback = parsedCaps.length < 3
      ? (cleanedContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [])
          .map(h => h.replace(/<[^>]+>/g, '').trim()).filter(t => t.length >= 4)
      : []
    const allCaps = [...parsedCaps, ...h2Fallback]

    // 이미지 개수 결정
    let numImages: number
    if (imageCount === 'fixed') {
      numImages = Math.max(1, imageCountMin || 1)
    } else {
      const min = Math.max(1, imageCountMin || 1)
      const max = Math.min(8, imageCountMax || 8)
      numImages = min + Math.floor(Math.random() * (max - min + 1))
    }
    console.log(`🖼 미리보기 이미지 ${numImages}개 생성 시작`)

    // 이미지 생성 → base64 배열
    const base64Images: string[] = []
    const cardCategory = (categoryStr).replace(/-/g, ' ').toUpperCase()

    for (let i = 0; i < numImages; i++) {
      const cap = allCaps[i] ?? keyword
      const caption = cap.length > 20 ? cap.slice(0, 20) + '…' : cap
      const buf = await generateCardImageBuffer({
        title:    finalTitle,
        captions: [caption],
        category: categoryStr,
        language,
        layout:   Math.floor(Math.random() * 30),
        variant:  i,
        siteName: siteData?.name,
      })
      if (buf) {
        base64Images.push(`data:image/png;base64,${buf.toString('base64')}`)
        console.log(`✅ 이미지 ${i + 1}/${numImages} 생성 완료`)
      } else {
        console.warn(`⚠️ 이미지 ${i + 1}/${numImages} 생성 실패`)
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
