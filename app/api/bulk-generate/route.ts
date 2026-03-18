/**
 * /api/bulk-generate
 * 예약 일괄 발행 팝업에서 "예약 스케줄 설정" 클릭 시 호출
 * - siteIds: 발행할 사이트 ID 목록
 * - ppdMin / ppdMax: 사이트당 하루 발행 글수 범위
 * - 오늘치 글을 즉시 생성 → publish_logs에 scheduled 상태로 저장
 * - cron/publish가 매시간 scheduled_at 지난 것 자동 발행
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { pickPromptByContentType, getCategoryInstruction } from '@/lib/prompts/seo-prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FIXED_SEO_REQUIREMENTS = `
[고정 SEO 요구사항]
1. <!-- META: [메타디스크립션 150자↓] -->
   <!-- TITLE: [H1 제목] -->
2. HTML 구조: h1(1개), h2(섹션), h3(세부), p(2~3문장), ul/ol, strong, blockquote
3. 주 키워드: H1, 첫 단락, 마지막 단락 자연 포함. LSI키워드 5개+ 분산
4. <!-- SCHEMA: Article | FAQPage -->
5. E-E-A-T: 구체적 수치/연구 언급, 전문 표현
6. [INTERNAL_LINK: 관련 주제] 형식으로 2~3곳 삽입
7. 본문 내 권위 출처 1~2개 자연스럽게 인용
   - 예: "대한피부과학회 가이드라인에 따르면", "2023년 NIH 연구에 의하면"
8. 의료 면책 조항 (본문 맨 아래): <p class="disclaimer"><strong>⚠️ 면책 조항:</strong> 이 글은 정보 제공 목적이며 전문 의료 조언을 대체하지 않습니다.</p>
`

/** 지금 이후 랜덤 시각 (최소 5분 후 ~ 최대 90분 후) */
function randomSoonTime(offsetIndex = 0): string {
  const now = new Date()
  // 각 글마다 최소 20분 간격
  const minOffset = 5 + offsetIndex * 20  // 분 단위
  const maxOffset = minOffset + 30
  const randomMin = minOffset + Math.floor(Math.random() * (maxOffset - minOffset))
  now.setMinutes(now.getMinutes() + randomMin)
  return now.toISOString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { siteIds, ppdMin = 1, ppdMax = 2 } = body as {
      siteIds: string[]
      ppdMin: number
      ppdMax: number
    }

    if (!siteIds?.length) {
      return NextResponse.json({ error: '사이트를 선택해주세요' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 선택된 사이트 조회
    const { data: sites, error: siteErr } = await supabase
      .from('sites')
      .select('*')
      .in('id', siteIds)

    if (siteErr || !sites?.length) {
      return NextResponse.json({ error: '사이트 조회 실패' }, { status: 500 })
    }

    // 페르소나 조회 (활성 상태)
    const { data: allPersonas } = await supabase
      .from('personas')
      .select('*')
      .eq('is_active', true)

    const results: Array<{ siteId: string; siteName: string; generated: number; error?: string }> = []
    let totalGenerated = 0

    for (const site of sites) {
      // 오늘 이미 예약된 글 수 확인
      const todayStart = new Date(); todayStart.setHours(0,0,0,0)
      const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999)
      const { count: todayCount } = await supabase
        .from('publish_logs')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', site.id)
        .in('status', ['scheduled', 'published', 'pending'])
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())

      // 오늘치 랜덤 발행 수 결정
      const alreadyToday = todayCount || 0
      const targetCount  = ppdMin + Math.floor(Math.random() * (ppdMax - ppdMin + 1))
      const toGenerate   = Math.max(0, targetCount - alreadyToday)

      if (toGenerate === 0) {
        results.push({ siteId: site.id, siteName: site.name, generated: 0, error: `이미 ${alreadyToday}개 예약됨` })
        continue
      }

      // 키워드 풀: 미사용 우선, 그 다음 최소 사용
      const { data: unusedKws } = await supabase
        .from('keywords')
        .select('*')
        .eq('language', site.language)
        .eq('is_active', true)
        .eq('used_count', 0)
        .limit(toGenerate * 3)

      const { data: usedKws } = await supabase
        .from('keywords')
        .select('*')
        .eq('language', site.language)
        .eq('is_active', true)
        .gt('used_count', 0)
        .order('used_count', { ascending: true })
        .limit(toGenerate * 3)

      const pool = [...(unusedKws || []), ...(usedKws || [])]
      if (!pool.length) {
        results.push({ siteId: site.id, siteName: site.name, generated: 0, error: '활성 키워드 없음' })
        continue
      }

      // 이 사이트 언어에 맞는 페르소나 찾기
      const sitePersonas = (allPersonas || []).filter(p => p.language === site.language)
      const personas = sitePersonas.length ? sitePersonas : (allPersonas || [])

      let siteGenerated = 0

      for (let i = 0; i < toGenerate; i++) {
        const randomKw = pool[Math.floor(Math.random() * Math.min(pool.length, toGenerate * 3))]
        if (!randomKw) continue

        const persona = personas[Math.floor(Math.random() * personas.length)]
        const seoTemplate = pickPromptByContentType('informational')
        const categoryInstruction = getCategoryInstruction(randomKw.category || site.category || 'health')

        const systemPrompt = persona?.system_prompt || 'You are a professional health content writer.'
        const combinedSystem = [systemPrompt, seoTemplate.systemInstruction, categoryInstruction]
          .filter(Boolean).join('\n\n---\n\n')

        const langInstruction =
          site.language === 'ko' ? '반드시 한국어로 작성하세요.' :
          site.language === 'ja' ? '必ず日本語で書いてください。' :
          'Write in English only.'

        const userPrompt = `${langInstruction}

키워드: "${randomKw.keyword}"
카테고리: ${randomKw.category || site.category || 'health'}
목표 글자 수: 1500자 이상

${seoTemplate.contentStructure}
${FIXED_SEO_REQUIREMENTS}

[이미지 문구 생성 필수]
본문 맨 마지막 줄에 아래 형식으로 이미지용 핵심 문구 4개를 언어에 맞게, 각 10~20자 이내로 작성하세요:
<!-- IMG_CAPTIONS: 문구1|문구2|문구3|문구4 -->

OUTPUT: 코드블록 없이 HTML만 출력
<!-- META: [메타디스크립션] -->
<!-- TITLE: [H1 제목] -->
<!-- SCHEMA: Article | FAQPage -->
[<h1>으로 시작하는 전체 HTML 본문]`

        try {
          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 4096,
            system: combinedSystem,
            messages: [{ role: 'user', content: userPrompt }],
          })

          const rawContent = message.content[0].type === 'text' ? message.content[0].text : ''
          const titleMatch = rawContent.match(/<!--\s*TITLE:\s*(.*?)\s*-->/)
          const metaMatch  = rawContent.match(/<!--\s*META:\s*(.*?)\s*-->/)
          const imgCaptionsMatch = rawContent.match(/<!--\s*IMG_CAPTIONS:\s*([^-]*?)\s*-->/i)
          const imageCaptions = imgCaptionsMatch
            ? imgCaptionsMatch[1].split('|').map((s: string) => s.trim()).filter(Boolean).slice(0, 4)
            : []
          const finalTitle = titleMatch?.[1] || randomKw.keyword
          const scheduledAt = randomSoonTime(i)

          const finalContent = rawContent
            .replace(/\[INTERNAL_LINK:\s*([^\]]+)\]/g, '')
            .replace(/<!--\s*IMG_CAPTIONS[^>]*-->/gi, '')
            .replace(/<!--\s*IMG[^>]*-->/g, '')

          const actualWordCount = rawContent.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length

          await supabase.from('publish_logs').insert({
            site_id:          site.id,
            keyword_text:     randomKw.keyword,
            title:            finalTitle,
            language:         site.language,
            category:         randomKw.category || site.category || 'health',
            word_count:       actualWordCount,
            prompt_type:      seoTemplate.id,
            scheduled_at:     scheduledAt,
            status:           'scheduled',
            claude_tokens:    message.usage.input_tokens + message.usage.output_tokens,
            content:          finalContent,
            meta_description: metaMatch?.[1] || null,
            prompt_used:      JSON.stringify({ id: seoTemplate.id, name: seoTemplate.name, imageCaptions }),
            keyword_id:       randomKw.id,
          })

          // 키워드 used_count 증가
          await supabase.from('keywords').update({
            used_count: (randomKw.used_count || 0) + 1,
            last_used_at: new Date().toISOString(),
          }).eq('id', randomKw.id)

          siteGenerated++
          totalGenerated++
        } catch (err) {
          console.error(`[BulkGenerate] ❌ ${site.name} 글 생성 실패:`, err)
        }

        // 글 간 딜레이
        if (i < toGenerate - 1) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      results.push({ siteId: site.id, siteName: site.name, generated: siteGenerated })
    }

    return NextResponse.json({
      success: true,
      totalGenerated,
      results,
      message: `${totalGenerated}개 글 생성 완료. publish cron이 예약 시각에 자동 발행합니다.`,
    })
  } catch (err) {
    console.error('[BulkGenerate] 오류:', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
