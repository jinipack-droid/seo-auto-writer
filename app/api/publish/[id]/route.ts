import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  publishToWordPress,
  extractMetaFromContent,
  getOrCreateWpCategory,
  uploadImageToWordPress,
  type WordPressSite,
} from '@/lib/wordpress/client'

/**
 * 이미지 서버 HTTP 호출 (localhost:3001)
 * @napi-rs/canvas native 모듈을 Next.js에서 직접 실행 불가 → 별도 image-server.mjs로 분리
 */
async function generateCardImageViaServer(data: {
  title: string; subtitle?: string; category: string; language: string;
  points?: Array<{ label: string; value: string }>; siteName?: string
}): Promise<Buffer> {
  const res = await fetch('http://localhost:3001/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`image-server 응답 오류: ${res.status} ${await res.text()}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
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

  // 로그 + 사이트 정보 조회
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

  // 콘텐츠 확인
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

  // 콘텐츠에서 제목/메타 추출
  const { title, metaDescription, content: cleanContent } = extractMetaFromContent(log.content)
  const finalTitle = title || log.title || '제목 없음'

  // WP 카테고리 처리
  let wpCategoryIds: number[] | undefined
  if (log.category) {
    const catId = await getOrCreateWpCategory(site, log.category)
    if (catId) wpCategoryIds = [catId]
  }

  // ── Step 1: 이미지 생성 & 미디어 업로드 (발행 전) ──
  const mediaItems: Array<{ id: number; url: string }> = []
  try {
    const cardCategory = (log.category || site.category || 'health') as string
    const cardLang = (log.language || 'en') as 'ko' | 'en' | 'ja'
    const numImages = 1 + Math.floor(Math.random() * 8)  // 1~8개 랜덤

    const cardBase = {
      title:    finalTitle,
      subtitle: log.keyword_text || '',
      category: cardCategory,
      language: cardLang,
      points: [
        { label: '카테고리', value: cardCategory.replace(/-/g, ' ').toUpperCase() },
        { label: '발행', value: new Date().toLocaleDateString('ko-KR') },
        { label: '사이트', value: site.name || 'SEO Writer' },
      ],
      siteName: site.name,
    }

    for (let i = 0; i < numImages; i++) {
      try {
        const imgBuffer = await generateCardImageViaServer(cardBase)
        const slug = finalTitle.replace(/[^a-zA-Z0-9가-힣]/g, '-').slice(0, 40)
        const filename = `manual-${slug}-${i + 1}-${Date.now()}.png`
        const media = await uploadImageToWordPress(site, imgBuffer, filename, `${finalTitle} 이미지 ${i + 1}`)
        if (media) {
          mediaItems.push(media)
          console.log(`✅ 이미지 ${i + 1}/${numImages} 업로드 완료 (id: ${media.id})`)
        } else {
          console.warn(`⚠️ 이미지 ${i + 1}/${numImages} 업로드 실패 (null 반환)`)
        }
      } catch (singleImgErr) {
        console.warn(`⚠️ 이미지 ${i + 1}/${numImages} 생성/업로드 오류:`, singleImgErr)
      }
    }
    console.log(`✅ 이미지 ${mediaItems.length}개 미리 업로드 완료`)
  } catch (imgErr) {
    console.warn('이미지 사전 생성 실패, 이미지 없이 발행:', imgErr)
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
        .sort((a, b) => b - a)  // 역순으로 삽입해야 위치 밀림 없음
      chosen.forEach((pos, idx) => {
        finalContent = finalContent.slice(0, pos) + imgTags[idx] + finalContent.slice(pos)
      })
      console.log(`✅ 본문에 이미지 ${imgTags.length}개 삽입 완료`)
    }
  }

  // ── Step 3: 이미지 포함 콘텐츠 WordPress 발행 ──
  const result = await publishToWordPress(site, {
    title:           finalTitle,
    content:         finalContent,
    metaDescription: metaDescription || log.meta_description || undefined,
    status:          'publish',
    categories:      wpCategoryIds,
    featuredMediaId: mediaItems[0]?.id,  // 첫 번째 이미지 = 대표 이미지
  })

  if (result.success) {
    // DB 업데이트
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
    // 실패 기록
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
