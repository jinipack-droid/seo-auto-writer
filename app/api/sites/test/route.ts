import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/sites/test
 * WordPress REST API 연결 테스트 (서버 사이드 프록시)
 * 브라우저에서 직접 fetch하면 CORS 차단되므로 반드시 서버를 통해 요청
 */
export async function POST(request: NextRequest) {
  try {
    const { wp_url, wp_username, wp_app_password } = await request.json()

    if (!wp_url || !wp_username || !wp_app_password) {
      return NextResponse.json({ success: false, message: 'WordPress URL, 아이디, 비밀번호를 모두 입력하세요.' }, { status: 400 })
    }

    // URL 정규화: 끝의 /wp-json/wp/v2 제거 후 다시 붙임
    const baseUrl = wp_url
      .replace(/\/+$/, '')
      .replace(/\/wp-json.*$/, '')

    const credentials = `${wp_username}:${wp_app_password}`
    const encoded = Buffer.from(credentials).toString('base64')
    const headers = {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json',
    }

    // Step 1: 사이트 기본 정보 조회 (wp-json)
    const siteRes = await fetch(`${baseUrl}/wp-json`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })

    if (!siteRes.ok) {
      return NextResponse.json({
        success: false,
        message: `WordPress 사이트에 접근할 수 없습니다. (HTTP ${siteRes.status})\n• URL이 올바른지 확인하세요: ${baseUrl}`,
      })
    }

    const siteInfo = await siteRes.json()

    // Step 2: 사용자 인증 확인 (wp-json/wp/v2/users/me)
    const userRes = await fetch(`${baseUrl}/wp-json/wp/v2/users/me`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })

    if (!userRes.ok) {
      // 401: 인증 실패
      if (userRes.status === 401) {
        return NextResponse.json({
          success: false,
          message: `인증 실패 (401)\n• 관리자 아이디를 확인하세요\n• Application Password가 올바른지 확인하세요\n• WP 대시보드 → 사용자 → 프로필 → Application Passwords`,
        })
      }
      // 403: 권한 부족
      if (userRes.status === 403) {
        return NextResponse.json({
          success: false,
          message: `권한 없음 (403)\n• 해당 계정에 글쓰기 권한이 있는지 확인하세요 (Editor 이상)`,
        })
      }
      return NextResponse.json({
        success: false,
        message: `인증 오류 (HTTP ${userRes.status})`,
      })
    }

    const userInfo = await userRes.json()

    return NextResponse.json({
      success: true,
      message: `✅ 연결 성공!`,
      siteName: siteInfo.name || baseUrl,
      userName: userInfo.name || wp_username,
      wpVersion: siteInfo.version || '알 수 없음',
      normalizedUrl: baseUrl,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    if (msg.includes('TimeoutError') || msg.includes('timeout')) {
      return NextResponse.json({
        success: false,
        message: `연결 시간 초과 (10초)\n• WordPress URL이 올바른지 확인하세요\n• 서버가 응답하고 있는지 확인하세요`,
      })
    }
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      return NextResponse.json({
        success: false,
        message: `사이트에 접근할 수 없습니다\n• URL을 다시 확인하세요\n• 서버가 온라인 상태인지 확인하세요`,
      })
    }

    return NextResponse.json({
      success: false,
      message: `연결 오류: ${msg}`,
    })
  }
}
