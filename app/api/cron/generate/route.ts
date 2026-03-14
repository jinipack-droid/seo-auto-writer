/**
 * /api/cron/generate
 * 매일 오전 6시 자동 실행 (vercel.json: "0 6 * * *")
 *
 * 동작 순서:
 * 1. 활성 사이트 전체 조회
 * 2. 각 사이트별 오늘 이미 예약/발행된 글 수 확인 → 일일 한도 계산
 * 3. 한도 미달 시 → 사이트 언어에 맞는 활성 키워드 랜덤 선택
 * 4. 해당 언어 + 카테고리 페르소나 랜덤 선택
 * 5. Claude API로 글 생성 (30종 SEO 프롬프트 랜덤)
 * 6. publish_logs에 status='scheduled', scheduled_at=오늘 8~21시 랜덤으로 저장
 * 7. cron/publish 가 매시간 scheduled_at이 지난 것을 발행
 *
 * 일일 한도:
 * - 사이트 등록 후 90일 이내: 하루 1~2개 (랜덤, 구글 신뢰도 구축 기간)
 * - 90일 이후: 하루 3~5개 (랜덤)
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { pickPromptByContentType, getCategoryInstruction } from '@/lib/prompts/seo-prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 페르소나 코드 → 언어 매핑
const PERSONA_LANGUAGE_MAP: Record<string, string> = {
  'P-01': 'en', 'P-02': 'en', 'P-03': 'en', 'P-04': 'en', 'P-05': 'en',
  'P-06': 'ko', 'P-08': 'ko',
  'P-07': 'ja',
}

// 페르소나 시스템 프롬프트 (generate/route.ts와 동일)
const PERSONA_PROMPTS: Record<string, string> = {
  'P-01': 'You are Dr. Sarah Mitchell, a board-certified dermatologist with 15 years of clinical experience. Write professional, evidence-based content with a warm, approachable tone.',
  'P-02': 'You are Jessica Park, a registered nurse and experienced health writer. Write in a conversational, empathetic tone that makes complex health topics easy to understand.',
  'P-03': 'You are Dr. Michael Chen, a nutrition scientist with a PhD. Write evidence-based content about nutrition and supplements.',
  'P-04': 'You are Emma Rodriguez, a certified esthetician with 10 years of skincare expertise.',
  'P-05': 'You are Dr. Lisa Thompson, a licensed pharmacist. Write with precision and focus on safety and evidence-based information.',
  'P-06': '당신은 김지은 에디터로, 10년 경력의 뷰티 전문 에디터입니다.',
  'P-07': 'あなたは田中美咲、ビューティーコンサルタントです。',
  'P-08': '당신은 박현주 원장으로, 피부과 전문의입니다.',
}

const FIXED_SEO_REQUIREMENTS = `
[고정 SEO 요구사항]
1. <!-- META: [메타디스크립션 150자↓] -->
   <!-- TITLE: [H1 제목] -->
2. HTML 구조: h1(1개), h2(섹션), h3(세부), p(2~3문장), ul/ol, strong, blockquote
3. 주 키워드: H1, 첫 단락, 마지막 단락 자연 포함. LSI키워드 5개+ 분산
4. <!-- SCHEMA: Article | FAQPage -->
5. E-E-A-T: 구체적 수치/연구 언급, 전문 표현
6. [INTERNAL_LINK: 관련 주제] 형식으로 2~3곳 삽입
7. 본문 내 권위 출처 1~2개 자연스럽게 인용 (별도 섹션 아닌 문장 안에 녹여넣기)
   - 예: "대한피부과학회 가이드라인에 따르면", "2023년 NIH 연구에 의하면", "厚生労働省の指針では"
   - 언어·카테고리에 맞는 기관 선택 (피부→피부과학회, 영양→영양학회)
8. 의료 면책 조항 (본문 맨 아래): <p class="disclaimer"><strong>⚠️ 면책 조항:</strong> 이 글은 정보 제공 목적이며 전문 의료 조언을 대체하지 않습니다.</p>
`

/**
 * 사이트가 등록된 후 며칠이 지났는지 계산
 */
function daysSinceCreated(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * 사이트 연령에 따른 일일 최대 발행 수
 * - 처음 90일: 1~2개 랜덤 (구글·네이버 신뢰도 구축 기간)
 * - 90일 이후: 3~5개 랜덤
 */
function getDailyLimit(siteCreatedAt: string): number {
  const days = daysSinceCreated(siteCreatedAt)
  if (days < 90) {
    return Math.random() < 0.5 ? 1 : 2
  }
  return 3 + Math.floor(Math.random() * 3) // 3, 4, 5
}

/**
 * 오늘 8~21시 사이의 랜덤 발행 시각 생성
 */
function randomPublishTime(offsetIndex = 0): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startHour = 8
  const endHour = 21
  const randomMin = startHour * 60 + Math.floor(Math.random() * (endHour - startHour) * 60)
  today.setMinutes(randomMin + offsetIndex * 50) // 여러 글은 50분 간격으로
  return today.toISOString()
}

export async function GET(request: NextRequest) {
  // 인증
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const todayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

  // 1. 활성 사이트 조회
  const { data: sites, error: siteErr } = await supabase
    .from('sites')
    .select('*')
    .eq('is_active', true)

  if (siteErr || !sites?.length) {
    return NextResponse.json({ message: '활성 사이트 없음', generated: 0 })
  }

  const results: Array<{ siteId: string; siteName: string; generated: number; skipped: string | null }> = []
  let totalGenerated = 0

  for (const site of sites) {
    // 2. 오늘 이미 예약/발행된 글 수 확인
    const { count: todayCount } = await supabase
      .from('publish_logs')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', site.id)
      .in('status', ['scheduled', 'published', 'pending'])
      .gte('scheduled_at', todayStart)
      .lt('scheduled_at', todayEnd)

    const dailyLimit = getDailyLimit(site.created_at)
    const alreadyToday = todayCount || 0

    if (alreadyToday >= dailyLimit) {
      results.push({ siteId: site.id, siteName: site.name, generated: 0, skipped: `이미 ${alreadyToday}개 예약됨 (한도: ${dailyLimit})` })
      continue
    }

    const toGenerate = dailyLimit - alreadyToday
    let siteGenerated = 0

    // 3. 사이트 언어에 맞는 활성 키워드 랜덤 선택 (아직 미사용 우선)
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
      results.push({ siteId: site.id, siteName: site.name, generated: 0, skipped: '활성 키워드 없음' })
      continue
    }

    // 4. 페르소나 랜덤 선택 (사이트 언어에 맞는 것)
    const langPersonas = Object.entries(PERSONA_LANGUAGE_MAP)
      .filter(([, lang]) => lang === site.language)
      .map(([code]) => code)
    const personaCodes = langPersonas.length ? langPersonas : ['P-01']

    for (let i = 0; i < toGenerate; i++) {
      const randomKw = pool[Math.floor(Math.random() * Math.min(pool.length, toGenerate * 3))]
      if (!randomKw) continue

      const personaCode = personaCodes[Math.floor(Math.random() * personaCodes.length)]
      const systemPrompt = PERSONA_PROMPTS[personaCode] || PERSONA_PROMPTS['P-01']
      const seoTemplate = pickPromptByContentType('informational')
      const categoryInstruction = getCategoryInstruction(site.category || 'health')

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
        // 이미지 캡션 파싱 (Claude가 생성한 이미지 문구)
        const imgCaptionsMatch = rawContent.match(/<!--\s*IMG_CAPTIONS:\s*([^-]*?)\s*-->/i)
        const imageCaptions = imgCaptionsMatch
          ? imgCaptionsMatch[1].split('|').map((s: string) => s.trim()).filter(Boolean).slice(0, 4)
          : []
        const finalTitle = titleMatch?.[1] || `[${seoTemplate.id}] ${randomKw.keyword}`
        const scheduledAt = randomPublishTime(i)

        // [INTERNAL_LINK] 플레이스홀더 제거 + HTML 주석 정리
        const contentCat  = randomKw.category || site.category || 'health'
        const finalContent = rawContent
          .replace(/\[INTERNAL_LINK:\s*([^\]]+)\]/g, '')   // 플레이스홀더 제거
          .replace(/<!--\s*IMG_CAPTIONS[^>]*-->/gi, '')       // 이미지 캡션 주석 제거
          .replace(/<!--\s*IMG[^>]*-->/g, '')                 // 이미지 힌트 주석 제거
          .replace(/<!--\s*LSI_KEYWORDS[^>]*-->/g, '')        // LSI 키워드 주석 제거
          .replace(/<!--\s*SOCIAL_COPY[^>]*-->/g, '')         // 소셜 카피 주석 제거
        const actualWordCount = rawContent.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, '').length

        await supabase.from('publish_logs').insert({
          site_id:          site.id,
          keyword_text:     randomKw.keyword,
          title:            finalTitle,
          language:         site.language,
          category:         contentCat,
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

        // 키워드 used_count 증가 + last_used_at 업데이트
        await supabase.from('keywords').update({
          used_count: (randomKw.used_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        }).eq('id', randomKw.id)

        siteGenerated++
        totalGenerated++
        console.log(`[CronGenerate] ✅ ${site.name}: "${randomKw.keyword}" → ${scheduledAt}`)
      } catch (err) {
        console.error(`[CronGenerate] ❌ ${site.name} 글 생성 실패:`, err)
      }

      // Claude API 요청 간 딜레이 (속도 제한 회피)
      await new Promise(r => setTimeout(r, 2000))
    }

    results.push({ siteId: site.id, siteName: site.name, generated: siteGenerated, skipped: null })
  }

  console.log(`[CronGenerate] 완료 — 총 ${totalGenerated}개 예약 생성`)

  return NextResponse.json({
    message: '콘텐츠 자동 생성 완료',
    totalGenerated,
    timestamp: new Date().toISOString(),
    results,
  })
}

/** POST: 수동 테스트용 */
export async function POST(request: NextRequest) {
  return GET(request)
}
