import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateCardImage } from '@/lib/image/satori-generator'
import {
  publishToWordPress,
  extractMetaFromContent,
  getOrCreateWpCategory,
  uploadImageToWordPress,
  type WordPressSite,
} from '@/lib/wordpress/client'


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

  // ── Step 1: 카드뉴스 이미지 생성 & 업로드 ──
  const mediaItems: Array<{ id: number; url: string }> = []
  try {
    const imgCategory = (log.category || site.category || 'health') as string
    const imgLanguage = (site.language || 'ko') as string
    const numImages = 1 + Math.floor(Math.random() * 4) // 1~4개 랜덤

    const h2Headings = [...cleanContent.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(s => s.length > 2)

    // Fisher-Yates 셔플 레이아웃
    const layoutPool = [0,1,2,3,4,5,6,7,8,9,10]
    for (let k = layoutPool.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));[layoutPool[k], layoutPool[j]] = [layoutPool[j], layoutPool[k]]
    }

    console.log(`[Publish] 🎨 카드뉴스 ${numImages}개 생성: "${finalTitle}"`)
    for (let i = 0; i < numImages; i++) {
      try {
        const imgTitle = h2Headings[i] ?? finalTitle
        const imgCaptions = h2Headings.filter((_, idx) => idx !== i).slice(0, 5)
        if (imgCaptions.length === 0) imgCaptions.push(log.keyword_text || finalTitle)

        const imgBuffer = await generateCardImage({
          title: imgTitle, captions: imgCaptions,
          category: imgCategory, language: imgLanguage,
          layout: layoutPool[i % layoutPool.length], variant: i,
          siteName: site.name,
        })
        if (!imgBuffer) { console.warn(`[Publish] ⚠️ 이미지 ${i+1} 생성 실패`); continue }
        const slug = finalTitle.replace(/[^a-zA-Z0-9가-힣]/g, '-').slice(0, 40)
        const filename = `card-${slug}-${i+1}-${Date.now()}.png`
        const altText = `${imgTitle} - ${log.keyword_text || finalTitle}`
        const media = await uploadImageToWordPress(site, imgBuffer, filename, altText)
        if (media) {
          mediaItems.push(media)
          console.log(`[Publish] ✅ 이미지 ${i+1}/${numImages} 업로드 완료 (id: ${media.id})`)
        }
      } catch (e) { console.warn(`[Publish] ⚠️ 이미지 ${i+1} 오류:`, e) }
    }
  } catch (imgErr) {
    console.warn('[Publish] 이미지 생성 실패, 이미지 없이 발행:', imgErr)
  }

  // ── Step 2: 나머지 이미지를 H2 뒤에 본문에 삽입 ──
  let finalContent = cleanContent

  // ── CSS 개선: 소제목 크기, word-break, 이미지 반응형 ──
  // H2 소제목 크기 & word-break
  finalContent = finalContent.replace(
    /<h2(\s[^>]*)?>/gi,
    (_, attrs = '') => `<h2${attrs} style="font-size:1.7em;font-weight:700;word-break:keep-all;overflow-wrap:break-word;line-height:1.4;margin:1.5em 0 0.5em;">`
  )
  // H3 소제목 크기 & word-break
  finalContent = finalContent.replace(
    /<h3(\s[^>]*)?>/gi,
    (_, attrs = '') => `<h3${attrs} style="font-size:1.35em;font-weight:600;word-break:keep-all;overflow-wrap:break-word;line-height:1.4;margin:1.2em 0 0.4em;">`
  )
  // 본문 p 태그: word-break 적용
  finalContent = finalContent.replace(
    /<p(\s[^>]*)?>/gi,
    (_, attrs = '') => `<p${attrs} style="word-break:keep-all;overflow-wrap:break-word;line-height:1.8;">`
  )
  // img 반응형 (모바일 대응)
  finalContent = finalContent.replace(
    /<img(\s[^>]*?)>/gi,
    (_, attrs = '') => `<img${attrs} style="max-width:100%;height:auto;display:block;">`
  )

  if (mediaItems.length > 1) {
    const imgTags = mediaItems.slice(1).map((media, idx) =>
      `\n<figure class="wp-block-image size-full"><img src="${media.url}" alt="${finalTitle} 이미지 ${idx + 2}" style="max-width:100%;height:auto;display:block;" /></figure>\n`
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
