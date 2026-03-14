'use client'
import { usePathname } from 'next/navigation'
import { useLang, type Lang } from '@/lib/language-context'

const NAV = [
  { icon: '👤', label: '아이디&페르소나', href: '/personas' },
  { icon: '🌐', label: '등록 사이트',     href: '/sites'    },
  { icon: '📋', label: '발행 로그',       href: '/logs'     },
  { icon: '🔑', label: '키워드',          href: '/keywords' },
  { icon: '⚙',  label: '설정',            href: '/settings' },
]

const LANGS: { code: Lang; flag: string; name: string; sub: string }[] = [
  { code: 'en', flag: '🇺🇸', name: 'English',  sub: 'Google' },
  { code: 'ko', flag: '🇰🇷', name: '한국어',    sub: 'Naver'  },
  { code: 'ja', flag: '🇯🇵', name: '日本語',    sub: 'Yahoo'  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { lang, setLang } = useLang()

  return (
    <nav style={{
      width: '190px', minHeight: '100vh',
      background: '#131313',
      borderRight: '1px solid #252525',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, bottom: 0,
    }}>
      {/* 로고 */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #252525' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{
            width: '30px', height: '30px', background: '#1E6AFF',
            borderRadius: '7px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '15px', fontWeight: '900', color: '#fff',
          }}>S</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '-0.3px' }}>SEO Writer</div>
            <div style={{ fontSize: '10px', color: '#444' }}>자동 글쓰기 v0.1</div>
          </div>
        </div>
      </div>

      {/* 언어 선택기 */}
      <div style={{ padding: '10px 8px', borderBottom: '1px solid #252525' }}>
        <div style={{ fontSize: '10px', color: '#444', marginBottom: '7px', paddingLeft: '4px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>국가 선택</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {LANGS.map(l => {
            const active = lang === l.code
            return (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                  border: active ? '1px solid rgba(30,106,255,0.5)' : '1px solid transparent',
                  background: active ? 'rgba(30,106,255,0.12)' : 'transparent',
                  transition: 'all 0.15s',
                  width: '100%', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1c1c1c' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '16px' }}>{l.flag}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: active ? '700' : '500', color: active ? '#1E6AFF' : '#888', lineHeight: 1.2 }}>{l.name}</div>
                  <div style={{ fontSize: '9px', color: '#444' }}>{l.sub}</div>
                </div>
                {active && <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#1E6AFF', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* 메뉴 */}
      <div style={{ flex: 1, padding: '6px 8px' }}>
        {NAV.map(item => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)

          return (
            <a key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '8px 10px', borderRadius: '6px',
              textDecoration: 'none', fontSize: '13px', marginBottom: '1px',
              color:      isActive ? '#1E6AFF' : '#777',
              background: isActive ? 'rgba(30,106,255,0.1)' : 'transparent',
              fontWeight: isActive ? '600' : '400',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => !isActive && (e.currentTarget.style.background = '#1c1c1c')}
            onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: '16px', textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </a>
          )
        })}
      </div>

      {/* 하단 상태 */}
      <div style={{ padding: '8px 8px 6px', borderTop: '1px solid #252525' }}>
        <div style={{ background: '#1c1c1c', borderRadius: '6px', padding: '8px 10px',
          marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="dot dot-green" />
          <div>
            <div style={{ fontSize: '11px', color: '#00c471', fontWeight: '600' }}>DB 연결됨</div>
            <div style={{ fontSize: '10px', color: '#444' }}>Supabase</div>
          </div>
        </div>
        <div style={{ background: '#1c1c1c', borderRadius: '6px', padding: '8px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', color: '#555' }}>claude-sonnet-4-5</span>
          <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 6px' }}>ON</span>
        </div>
      </div>
    </nav>
  )
}

