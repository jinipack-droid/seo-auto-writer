import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { username, password } = await request.json()

  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || '@dldnwls77'
  const authSecret = process.env.AUTH_SECRET || 'seo-auto-writer-secret-2024'

  if (username === adminUsername && password === adminPassword) {
    const response = NextResponse.json({ success: true })
    response.cookies.set('auth_session', authSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    })
    return response
  }

  return NextResponse.json(
    { success: false, error: '아이디 또는 비밀번호가 틀렸습니다.' },
    { status: 401 }
  )
}
