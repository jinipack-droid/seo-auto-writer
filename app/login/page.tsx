'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (data.success) {
        router.push('/')
        router.refresh()
      } else {
        setError(data.error || '로그인에 실패했습니다.')
      }
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* 배경 그라디언트 효과 */}
      <div style={{
        position: 'fixed',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.08) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '0 24px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* 로고 & 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
            fontSize: '28px',
          }}>
            ✍️
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#ffffff',
            margin: '0 0 8px',
            letterSpacing: '-0.5px',
          }}>
            SEO Auto Writer
          </h1>
          <p style={{
            fontSize: '15px',
            color: '#6b7280',
            margin: 0,
          }}>
            관리자 로그인
          </p>
        </div>

        {/* 로그인 카드 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '36px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        }}>
          <form onSubmit={handleLogin}>
            {/* 아이디 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#9ca3af',
                marginBottom: '8px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}>
                아이디
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                required
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(99, 102, 241, 0.6)'
                  e.target.style.background = 'rgba(99, 102, 241, 0.08)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.target.style.background = 'rgba(255, 255, 255, 0.06)'
                }}
              />
            </div>

            {/* 비밀번호 */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#9ca3af',
                marginBottom: '8px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(99, 102, 241, 0.6)'
                  e.target.style.background = 'rgba(99, 102, 241, 0.08)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.target.style.background = 'rgba(255, 255, 255, 0.06)'
                }}
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#f87171',
                fontSize: '14px',
                textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading
                  ? 'rgba(99, 102, 241, 0.5)'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99, 102, 241, 0.4)',
                letterSpacing: '0.3px',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)'
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          fontSize: '13px',
          color: '#4b5563',
        }}>
          SEO Auto Writer &copy; 2024
        </p>
      </div>
    </div>
  )
}
