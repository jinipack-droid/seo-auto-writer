import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createServiceClient } from '@/lib/supabase/server'
import {
  publishToWordPress,
  extractMetaFromContent,
  getOrCreateWpCategory,
  uploadImageToWordPress,
  setFeaturedImage,
  type WordPressSite,
} from '@/lib/wordpress/client'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

/**
 * 기사 내용에서 이미지용 영문 프롬프트 생성
 */
function buildImagePrompt(title: string, category: string, h2Headings: string[], index: number): string {
  const catMap: Record<string, string> = {
    'health': 'health and wellness', 'skin-care': 'skincare and beauty',
    'nutrition': 'nutrition and diet', 'fitness': 'fitness and exercise',
    'medical': 'medical and healthcare', 'beauty': 'beauty and cosmetics',
    'diet': 'diet and weight loss', 'supplement': 'supplements and vitamins',
    'mental-health': 'mental health and mindfulness', 'lifestyle': 'healthy lifestyle',
  }
  const catEn = catMap[category] || category.replace(/-/g, ' ')

  // 이미지마다 다른 시각적 테마
  const themes = [
    `professional studio photo, clean modern style`,
    `lifestyle photography, warm natural lighting`,
    `flat lay composition, minimalist aesthetic`,
    `close-up detail shot, high contrast`,
    `editorial photography, vibrant colors`,
  ]
  const theme = themes[index % themes.length]
  const sectionHint = h2Headings[index] ? `, specifically about "${h2Headings[index].slice(0, 40)}"` : ''

  return `High-quality, professional photograph for a ${catEn} blog article titled "${title.slice(0, 60)}"${sectionHint}. The image should be visually compelling and relevant to the topic. Style: ${theme}. No text, no watermarks, no logos in the image. Photorealistic, magazine quality, 1:1 aspect ratio.`
}

/**
 * Gemini AI 이미지 생성 (gemini-2.0-flash-preview-image-generation)
 */
async function generateImageViaGemini(
  prompt: string
): Promise<Buffer | null> {
  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['IMAGE'],
        numberOfImages: 1,
      } as Record<string, unknown>,
    })
    const parts = response.candidates?.[0]?.content?.parts
    if (!parts) return null
    for (const part of parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64')
      }
    }
    return null
  } catch (err) {
    console.warn('[Gemini Image] 생성 실패:', err)
    return null
  }
}


/**
 * Vercel Cron Job 핸들러
 * 매시간 실행: 예약된 글(status='scheduled', scheduled_at <= now()) 자동 발행
 *
 * vercel.json:
 * { "crons": [{ "path": "/api/cron/publish", "schedule": "0 * * * *" }] }
 *
 * 환경변수: CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // ── 인증: Vercel Cron Secret 또는 직접 호출 시 Authorization 헤더 ──
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // 프로덕션 환경에서는 반드시 CRON_SECRET 검증
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // 개발 환경에서는 CRON_SECRET 없어도 통과
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // ── 발행 대상 조회: scheduled & 예약 시각이 지난 것 ──
  const { data: pendingLogs, error: fetchError } = await supabase
    .from('publish_logs')
    .select(`
      *,
      sites (
        id, name, wp_url, wp_username, wp_app_password, language, category
      )
    `)
    .in('status', ['scheduled', 'pending'])
    .lte('scheduled_at', now)
    .not('content', 'is', null)
    .order('scheduled_at', { ascending: true })
    .limit(20) // 한 번에 최대 20개 처리

  if (fetchError) {
    console.error('[Cron] DB 조회 오류:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!pendingLogs || pendingLogs.length === 0) {
    return NextResponse.json({
      message: '발행할 예약 글이 없습니다.',
      processed: 0,
      timestamp: now,
    })
  }

  console.log(`[Cron] 발행 대상 ${pendingLogs.length}건 처리 시작`)

  const results = {
    total:   pendingLogs.length,
    success: 0,
    failed:  0,
    skipped: 0,
    details: [] as Array<{ logId: string; status: string; message: string }>,
  }

  for (const log of pendingLogs) {
    const site = log.sites as WordPressSite | null

    // 사이트 정보가 없거나 WP 설정이 없으면 스킵
    if (!site || !site.wp_url || !site.wp_username || !site.wp_app_password) {
      await supabase.from('publish_logs').update({
        status: 'failed',
        error_message: '사이트 WP 설정이 없습니다.',
      }).eq('id', log.id)

      results.skipped++
      results.details.push({
        logId: log.id,
        status: 'skipped',
        message: '사이트 WP 설정 없음',
      })
      continue
    }

    // HTML에서 제목/메타 추출
    const { title, metaDescription, content: cleanContent } = extractMetaFromContent(log.content)
    const finalTitle = title || log.title || '제목 없음'

    // WP 카테고리 자동 생성/조회
    let wpCategoryIds: number[] | undefined
    if (log.category) {
      const catId = await getOrCreateWpCategory(site, log.category)
      if (catId) wpCategoryIds = [catId]
    }

    // ── Step 1: Gemini AI 이미지 생성 & 업로드 ──
    const mediaItems: Array<{ id: number; url: string }> = []
    const geminiKey = process.env.GEMINI_API_KEY
    if (geminiKey?.startsWith('AIza')) {
      try {
        const imgCategory = (log.category || site.category || 'health') as string
        const numImages = 1 + Math.floor(Math.random() * 5) // 1~5개 랜덤

        // H2 섹션 제목 추출 (이미지별 다른 프롬프트 생성에 사용)
        const h2Headings = [...cleanContent.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)]
          .map(m => m[1].replace(/<[^>]+>/g, '').trim())
          .filter(s => s.length > 2)

        console.log(`[Cron] 🎨 Gemini 이미지 ${numImages}개 생성 시작: "${finalTitle}"`)

        for (let i = 0; i < numImages; i++) {
          try {
            const prompt = buildImagePrompt(finalTitle, imgCategory, h2Headings, i)
            console.log(`[Cron] 🖼 이미지 ${i + 1}/${numImages} 프롬프트: ${prompt.slice(0, 80)}...`)

            const imgBuffer = await generateImageViaGemini(prompt)
            if (!imgBuffer) {
              console.warn(`[Cron] ⚠️ 이미지 ${i + 1}/${numImages} Gemini 생성 실패 (null)`)
              continue
            }

            const slug = finalTitle.replace(/[^a-zA-Z0-9가-힣]/g, '-').slice(0, 40)
            const filename = `ai-${slug}-${i + 1}-${Date.now()}.png`
            const media = await uploadImageToWordPress(
              site, imgBuffer, filename, `${finalTitle} 이미지 ${i + 1}`
            )
            if (media) {
              mediaItems.push(media)
              console.log(`[Cron] ✅ 이미지 ${i + 1}/${numImages} 업로드 완료 (id: ${media.id})`)
            }
            // Gemini API 속도 제한 방지 (이미지당 3초 간격)
            if (i < numImages - 1) await new Promise(r => setTimeout(r, 3000))
          } catch (singleImgErr) {
            console.warn(`[Cron] ⚠️ 이미지 ${i + 1}/${numImages} 오류:`, singleImgErr)
          }
        }
        console.log(`[Cron] 이미지 ${mediaItems.length}개 업로드 완료`)
      } catch (imgErr) {
        console.warn('[Cron] 이미지 생성 실패, 이미지 없이 발행:', imgErr)
      }
    } else {
      console.warn('[Cron] ⚠️ GEMINI_API_KEY 미설정 — 이미지 없이 발행')
    }

    // ── Step 2: 나머지 이미지를 H2 뒤에 본문에 삽입 ──
    let finalContent = cleanContent
    if (mediaItems.length > 1) {
      const imgTags = mediaItems.slice(1).map((media, idx) =>
        `\n<figure class="wp-block-image size-full"><img src="${media.url}" alt="${finalTitle} 이미지 ${idx + 2}" /></figure>\n`
      )
      const h2Regex = /<\/h2>/gi
      const h2Positions: number[] = []
      let h2Match
      while ((h2Match = h2Regex.exec(finalContent)) !== null) {
        h2Positions.push(h2Match.index + h2Match[0].length)
      }
      if (h2Positions.length > 0) {
        const chosen = h2Positions
          .sort(() => Math.random() - 0.5)
          .slice(0, imgTags.length)
          .sort((a, b) => b - a)  // 역순 삽입
        chosen.forEach((pos, idx) => {
          finalContent = finalContent.slice(0, pos) + imgTags[idx] + finalContent.slice(pos)
        })
        console.log(`[Cron] ✅ 본문에 이미지 ${imgTags.length}개 삽입 완료`)
      }
    }

    // ── Step 3: 이미지 포함 콘텐츠 WordPress에 발행 ──
    const publishResult = await publishToWordPress(site, {
      title:           finalTitle,
      content:         finalContent,
      metaDescription: metaDescription || log.meta_description || undefined,
      status:          'publish',
      categories:      wpCategoryIds,
      featuredMediaId: mediaItems[0]?.id,  // 첫 번째 이미지 = 대표 이미지
    })

    if (publishResult.success) {
      // 성공: published 상태로 업데이트
      await supabase.from('publish_logs').update({
        status:        'published',
        wp_post_id:    publishResult.postId,
        wp_post_url:   publishResult.postUrl,
        published_at:  new Date().toISOString(),
        error_message: null,
        title:         finalTitle,
        image_count:   mediaItems.length,
      }).eq('id', log.id)

      results.success++
      results.details.push({
        logId: log.id,
        status: 'published',
        message: `발행 완료 (이미지 ${mediaItems.length}개): ${publishResult.postUrl}`,
      })
      console.log(`[Cron] ✅ 발행 성공: ${finalTitle} → ${publishResult.postUrl}`)

      // ── Step 4: 대표 이미지가 누락된 경우 별도로 설정 ──
      if (publishResult.postId && mediaItems.length > 0 && !mediaItems[0]?.id) {
        try {
          await setFeaturedImage(site, publishResult.postId, mediaItems[0].id)
        } catch (featErr) {
          console.warn('[Cron] 대표 이미지 설정 실패:', featErr)
        }
      }
    } else {
      // 실패: failed 상태로 업데이트
      await supabase.from('publish_logs').update({
        status: 'failed',
        error_message: publishResult.error,
      }).eq('id', log.id)

      results.failed++
      results.details.push({
        logId: log.id,
        status: 'failed',
        message: publishResult.error || '알 수 없는 오류',
      })

      console.error(`[Cron] ❌ 발행 실패: ${finalTitle} — ${publishResult.error}`)
    }

    // API 요청 간 딜레이 (WP 서버 부하 방지)
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`[Cron] 완료 — 성공: ${results.success}, 실패: ${results.failed}, 스킵: ${results.skipped}`)

  return NextResponse.json({
    message:   `처리 완료`,
    timestamp: now,
    ...results,
  })
}

/**
 * POST: 수동으로 Cron 트리거 (개발/테스트 용도)
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
