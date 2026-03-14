/**
 * WordPress REST API 클라이언트
 * Application Password 방식 인증
 */

export interface WordPressSite {
  id: string
  name: string
  wp_url: string
  wp_username: string
  wp_app_password: string
  language: string
  category: string
}

export interface WordPressPostData {
  title: string
  content: string
  metaDescription?: string
  status?: 'publish' | 'draft' | 'future' | 'pending'
  scheduledDate?: string   // ISO 8601 형식 (future 상태일 때 사용)
  categories?: number[]
  tags?: number[]
  featuredMediaId?: number
}

export interface WordPressPostResult {
  success: boolean
  postId?: number
  postUrl?: string
  editUrl?: string
  error?: string
}

/**
 * HTML 콘텐츠에서 메타 정보 추출
 * <!-- META: ... --> 및 <!-- TITLE: ... --> 주석 파싱
 */
export function extractMetaFromContent(html: string): {
  title: string
  metaDescription: string
  content: string
} {
  let title = ''
  let metaDescription = ''
  let content = html

  // <!-- META: ... --> 추출
  const metaMatch = html.match(/<!--\s*META:\s*(.*?)\s*-->/)
  if (metaMatch) {
    metaDescription = metaMatch[1].trim()
    content = content.replace(metaMatch[0], '').trim()
  }

  // <!-- TITLE: ... --> 추출
  const titleMatch = html.match(/<!--\s*TITLE:\s*(.*?)\s*-->/)
  if (titleMatch) {
    title = titleMatch[1].trim()
    content = content.replace(titleMatch[0], '').trim()
  } else {
    // <!-- TITLE 없으면 <h1> 에서 추출
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
    if (h1Match) {
      title = h1Match[1].replace(/<[^>]+>/g, '').trim()
    }
  }

  // <!-- PROMPT_ID: ... --> 제거 (WP에 올리지 않음)
  content = content.replace(/<!--\s*PROMPT_ID:.*?-->/g, '').trim()

  return { title, metaDescription, content }
}

/**
 * WordPress REST API 기본 헤더 생성
 */
function getAuthHeaders(site: WordPressSite): HeadersInit {
  const credentials = `${site.wp_username}:${site.wp_app_password}`
  const encoded = Buffer.from(credentials).toString('base64')
  return {
    'Authorization': `Basic ${encoded}`,
    'Content-Type': 'application/json',
  }
}

/**
 * WordPress REST API URL 정규화
 */
function normalizeWpUrl(wpUrl: string): string {
  // 이미 /wp-json/wp/v2 가 있으면 그대로, 없으면 추가
  const base = wpUrl.replace(/\/+$/, '')
  if (base.includes('/wp-json')) {
    return base.replace(/\/wp-json.*$/, '/wp-json/wp/v2')
  }
  return `${base}/wp-json/wp/v2`
}

/**
 * WordPress 연결 테스트
 */
export async function testWordPressConnection(site: WordPressSite): Promise<{
  success: boolean
  message: string
  siteName?: string
  wordPressVersion?: string
}> {
  try {
    const apiBase = normalizeWpUrl(site.wp_url)

    // 사이트 기본 정보 조회
    const siteInfoRes = await fetch(`${apiBase.replace('/wp/v2', '')}`, {
      headers: getAuthHeaders(site),
      signal: AbortSignal.timeout(10000),
    })

    if (!siteInfoRes.ok) {
      return {
        success: false,
        message: `연결 실패 (HTTP ${siteInfoRes.status}): 인증 정보를 확인해주세요.`,
      }
    }

    // 사용자 권한 확인
    const usersRes = await fetch(`${apiBase}/users/me`, {
      headers: getAuthHeaders(site),
      signal: AbortSignal.timeout(10000),
    })

    if (!usersRes.ok) {
      return {
        success: false,
        message: `인증 실패 (HTTP ${usersRes.status}): 사용자명과 Application Password를 확인해주세요.`,
      }
    }

    const userInfo = await usersRes.json()
    const wpVersion = siteInfoRes.headers.get('X-WP-WPVersion') || 'Unknown'

    return {
      success: true,
      message: `연결 성공! (사용자: ${userInfo.name})`,
      siteName: userInfo.name,
      wordPressVersion: wpVersion,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류'
    if (msg.includes('timeout') || msg.includes('TimeoutError')) {
      return { success: false, message: '연결 시간 초과 (10초). WordPress URL을 확인해주세요.' }
    }
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      return { success: false, message: `사이트에 접근할 수 없습니다: ${site.wp_url}` }
    }
    return { success: false, message: `오류: ${msg}` }
  }
}

/**
 * WordPress에 글 발행
 */
export async function publishToWordPress(
  site: WordPressSite,
  postData: WordPressPostData
): Promise<WordPressPostResult> {
  try {
    const apiBase = normalizeWpUrl(site.wp_url)

    // Yoast SEO 메타 설정 (플러그인이 있을 경우 적용)
    const postBody: Record<string, unknown> = {
      title:   postData.title,
      content: postData.content,
      status:  postData.status || 'publish',
    }

    // 예약 발행 시 date 설정
    if (postData.status === 'future' && postData.scheduledDate) {
      postBody.date = postData.scheduledDate
    }

    // 카테고리/태그 설정
    if (postData.categories?.length) postBody.categories = postData.categories
    if (postData.tags?.length) postBody.tags = postData.tags
    if (postData.featuredMediaId) postBody.featured_media = postData.featuredMediaId

    // 메타 디스크립션 (Yoast/RankMath SEO 플러그인 지원)
    if (postData.metaDescription) {
      postBody.meta = {
        _yoast_wpseo_metadesc: postData.metaDescription,  // Yoast SEO
        rank_math_description: postData.metaDescription,   // RankMath
      }
    }

    const response = await fetch(`${apiBase}/posts`, {
      method: 'POST',
      headers: getAuthHeaders(site),
      body: JSON.stringify(postBody),
      signal: AbortSignal.timeout(30000),
    })

    const result = await response.json()

    if (!response.ok) {
      const errorMsg = result.message || result.error || `HTTP ${response.status}`
      return {
        success: false,
        error: `WordPress 발행 실패: ${errorMsg}`,
      }
    }

    return {
      success: true,
      postId: result.id,
      postUrl: result.link,
      editUrl: `${site.wp_url.replace(/\/wp-json.*$/, '')}/wp-admin/post.php?post=${result.id}&action=edit`,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류'
    return {
      success: false,
      error: `WordPress 연결 오류: ${msg}`,
    }
  }
}

/**
 * WordPress 카테고리 목록 조회 / 자동 생성
 * 없으면 생성하고 ID 반환
 */
export async function getOrCreateWpCategory(
  site: WordPressSite,
  categoryName: string
): Promise<number | null> {
  try {
    const apiBase = normalizeWpUrl(site.wp_url)

    // 기존 카테고리 검색
    const searchRes = await fetch(
      `${apiBase}/categories?search=${encodeURIComponent(categoryName)}&per_page=1`,
      { headers: getAuthHeaders(site), signal: AbortSignal.timeout(10000) }
    )

    if (searchRes.ok) {
      const categories = await searchRes.json()
      if (categories.length > 0) return categories[0].id
    }

    // 없으면 생성
    const createRes = await fetch(`${apiBase}/categories`, {
      method: 'POST',
      headers: getAuthHeaders(site),
      body: JSON.stringify({ name: categoryName }),
      signal: AbortSignal.timeout(10000),
    })

    if (createRes.ok) {
      const newCat = await createRes.json()
      return newCat.id
    }

    return null
  } catch {
    return null
  }
}

/**
 * WordPress 미디어 업로드 (카드 이미지 → 대표 이미지)
 * @returns 업로드된 미디어 ID (실패 시 null)
 */
export async function uploadImageToWordPress(
  site: WordPressSite,
  imageBuffer: Uint8Array,
  filename: string,
  altText?: string,
): Promise<{ id: number; url: string } | null> {
  try {
    const apiBase = normalizeWpUrl(site.wp_url)
    const credentials = `${site.wp_username}:${site.wp_app_password}`
    const encoded = Buffer.from(credentials).toString('base64')

    const formData = new FormData()
    const blob = new Blob([Buffer.from(imageBuffer)], { type: 'image/png' })
    formData.append('file', blob, filename)
    if (altText) formData.append('alt_text', altText)

    const res = await fetch(`${apiBase}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${encoded}` },
      body: formData,
      signal: AbortSignal.timeout(120_000),  // 120초 (이미지 업로드는 느릴 수 있음)
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.warn(`이미지 업로드 실패: HTTP ${res.status}`, errBody.slice(0, 200))
      return null
    }

    const data = await res.json()
    if (!data.id) return null
    return { id: data.id, url: data.source_url ?? data.guid?.rendered ?? '' }
  } catch (e) {
    console.warn('이미지 업로드 오류:', e)
    return null
  }
}

/**
 * WordPress 포스트에 대표 이미지 설정
 */
export async function setFeaturedImage(
  site: WordPressSite,
  postId: number,
  mediaId: number,
): Promise<boolean> {
  try {
    const apiBase = normalizeWpUrl(site.wp_url)
    const res = await fetch(`${apiBase}/posts/${postId}`, {
      method: 'POST',
      headers: getAuthHeaders(site),
      body: JSON.stringify({ featured_media: mediaId }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

