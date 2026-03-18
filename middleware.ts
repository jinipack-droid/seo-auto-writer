import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 로그인 페이지, 인증 API, cron API는 인증 없이 통과
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron')
  ) {
    return NextResponse.next()
  }

  // 세션 쿠키 확인
  const session = request.cookies.get('auth_session')
  const authSecret = process.env.AUTH_SECRET || 'seo-auto-writer-secret-2024'

  if (!session || session.value !== authSecret) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
