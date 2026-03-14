import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createServiceClient } from '@/lib/supabase/server'
import {
  publishToWordPress,
  extractMetaFromContent,
  getOrCreateWpCategory,
  uploadImageToWordPress,
  type WordPressSite,
} from '@/lib/wordpress/client'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

/** 기사 내용에서 이미지용 영문 프롬프트 생성 */
function buildImagePrompt(title: string, category: string, h2Headings: string[], index: number): string {
  const catMap: Record<string, string> = {
    'health': 'health and wellness', 'skin-care': 'skincare and beauty',
    'nutrition': 'nutrition and diet', 'fitness': 'fitness and exercise',
    'medical': 'medical and healthcare', 'beauty': 'beauty and cosmetics',
    'diet': 'diet and weight loss', 'supplement': 'supplements and vitamins',
    'mental-health': 'mental health and mindfulness', 'lifestyle': 'healthy lifestyle',
  }
  const catEn = catMap[category] || category.replace(/-/g, ' ')
  const themes = [
    'professional studio photo, clean modern style',
    'lifestyle photography, warm natural lighting',
    'flat lay composition, minimalist aesthetic',
    'close-up detail shot, high contrast',
    'editorial photography, vibrant colors',
  ]
  const theme = themes[index % themes.length]
  const sectionHint = h2Headings[index] ? `, specifically about "${h2Headings[index].slice(0, 40)}"` : ''
  return `High-quality, professional photograph for a ${catEn} blog article titled "${title.slice(0, 60)}"${sectionHint}. The image should be visually compelling and relevant to the topic. Style: ${theme}. No text, no watermarks, no logos. Photorealistic, magazine quality, 1:1 aspect ratio.`
}

/** Gemini AI 이미지 생성 */
async function generateImageViaGemini(prompt: string): Promise<Buffer | null> {
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
      if (part.inlineData?.data) return Buffer.from(part.inlineData.data, 'base64')
    }
    return null
  } catch (err) {
    console.warn('[Gemini Image] 생성 실패:', err)
    return null
  }
}

/**
 * POST /api/publish/[id]
 * 특정 로그 ID의 글을 WordPress에 즉시 발행 (이미지 포함)
 * 발행 로그 페이지의 "지금 발행" 버튼에서 호출
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: '로그 ID가 없습니다.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: log, error: fetchError } = await supabase
    .from('publish_logs')
    .select(`
      *,
      sites (
        id, name, wp_url, wp_username, wp_app_password, language, category
      )
    `)
    .eq('id', id)
    .single()

  if (fetchError || !log) {
    return NextResponse.json({ error: '로그를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (log.status === 'published') {
    return NextResponse.json({ error: '이미 발행된 글입니다.', wp_post_url: log.wp_post_url }, { status: 400 })
  }

  if (!log.content) {
    return NextResponse.json({
      error: '저장된 콘텐츠가 없습니다. 글을 다시 생성해주세요.',
    }, { status: 400 })
  }

  const site = log.sites as WordPressSite | null

  if (!site || !site.wp_url || !site.wp_username || !site.wp_app_password) {
    return NextResponse.json({
      error: '사이트의 WordPress 연결 정보가 없습니다. 사이트 관리 페이지에서 설정하세요.',
    }, { status: 400 })
  }

  const { title, metaDescription, content: cleanContent } = extractMetaFromContent(log.content)
  const finalTitle = title || log.title || '제목 없음'

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

      const h2Headings = [...cleanContent.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(s => s.length > 2)

      console.log(`[Publish] 🎨 Gemini 이미지 ${numImages}개 생성: "${finalTitle}"`)

      for (let i = 0; i < numImages; i++) {
        try {
          const prompt = buildImagePrompt(finalTitle, imgCategory, h2Headings, i)
          console.log(`[Publish] 🖼 이미지 ${i + 1}/${numImages}: ${prompt.slice(0, 100)}...`)

          const imgBuffer = await generateImageViaGemini(prompt)
          if (!imgBuffer) {
            console.warn(`[Publish] ⚠️ 이미지 ${i + 1}/${numImages} 생성 실패 (null)`)
            continue
          }
          const slug = finalTitle.replace(/[^a-zA-Z0-9가-힣]/g, '-').slice(0, 40)
          const filename = `ai-${slug}-${i + 1}-${Date.now()}.png`
          const media = await uploadImageToWordPress(site, imgBuffer, filename, `${finalTitle} 이미지 ${i + 1}`)
          if (media) {
            mediaItems.push(media)
            console.log(`[Publish] ✅ 이미지 ${i + 1}/${numImages} 업로드 완료 (id: ${media.id})`)
          }
          if (i < numImages - 1) await new Promise(r => setTimeout(r, 3000))
        } catch (e) {
          console.warn(`[Publish] ⚠️ 이미지 ${i + 1} 오류:`, e)
        }
      }
    } catch (imgErr) {
      console.warn('[Publish] 이미지 생성 실패, 이미지 없이 발행:', imgErr)
    }
  } else {
    console.warn('[Publish] ⚠️ GEMINI_API_KEY 미설정 — 이미지 없이 발행')
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
        .sort((a, b) => b - a)
      chosen.forEach((pos, idx) => {
        finalContent = finalContent.slice(0, pos) + imgTags[idx] + finalContent.slice(pos)
      })
      console.log(`[Publish] ✅ 본문에 이미지 ${imgTags.length}개 삽입 완료`)
    }
  }

  // ── Step 3: WordPress 발행 ──
  const result = await publishToWordPress(site, {
    title:           finalTitle,
    content:         finalContent,
    metaDescription: metaDescription || log.meta_description || undefined,
    status:          'publish',
    categories:      wpCategoryIds,
    featuredMediaId: mediaItems[0]?.id,
  })

  if (result.success) {
    await supabase.from('publish_logs').update({
      status:        'published',
      wp_post_id:    result.postId,
      wp_post_url:   result.postUrl,
      published_at:  new Date().toISOString(),
      error_message: null,
      title:         finalTitle,
      image_count:   mediaItems.length,
    }).eq('id', id)

    return NextResponse.json({
      success:    true,
      postId:     result.postId,
      postUrl:    result.postUrl,
      editUrl:    result.editUrl,
      title:      finalTitle,
      siteName:   site.name,
      imageCount: mediaItems.length,
    })
  } else {
    await supabase.from('publish_logs').update({
      status:        'failed',
      error_message: result.error,
    }).eq('id', id)

    return NextResponse.json({
      success: false,
      error:   result.error,
    }, { status: 500 })
  }
}
