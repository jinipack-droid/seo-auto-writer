'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'

interface EnvStatus {
  supabase: boolean
  anthropic: boolean
  gemini: boolean
}

type TabId = 'api' | 'seo' | 'about'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'api',   icon: '🔑', label: 'API 설정' },
  { id: 'seo',   icon: '📈', label: 'SEO 기본값' },
  { id: 'about', icon: 'ℹ️',  label: '시스템 정보' },
]


const SEO_DEFAULTS_KEY = 'seo_defaults'
const SCHEDULE_KEY = 'schedule_settings'

const DEFAULT_SEO = {
  minWords: 1500,
  maxWords: 2500,
  keywordDensity: '1.5',
  includeSchema: true,
  includeFaq: true,
  includeDisclaimer: true,
  defaultLang: 'en',
  defaultContentType: 'informational',
}

const DEFAULT_SCHEDULE = {
  enabled: false,
  dailyLimit: 5,
  startHour: 8,
  endHour: 22,
  randomDelay: true,
  delayMinutes: 30,
  timezone: 'Asia/Seoul',
  runDays: ['mon','tue','wed','thu','fri'],
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('api')
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null)
  const [seo, setSeo] = useState({ ...DEFAULT_SEO })
  const [schedule, setSchedule] = useState({ ...DEFAULT_SCHEDULE })
  const [toast, setToast] = useState('')
  const [saved, setSaved] = useState(false)

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setSaved(ok)
    setTimeout(() => { setToast(''); setSaved(false) }, 2500)
  }

  // 환경변수 상태 체크
  useEffect(() => {
    fetch('/api/settings/status')
      .then(r => r.json())
      .then(d => setEnvStatus(d))
      .catch(() => setEnvStatus({ supabase: false, anthropic: false, gemini: false }))
  }, [])

  // 로컬스토리지에서 설정 불러오기
  useEffect(() => {
    try {
      const s = localStorage.getItem(SEO_DEFAULTS_KEY)
      if (s) setSeo(JSON.parse(s))
      const sc = localStorage.getItem(SCHEDULE_KEY)
      if (sc) setSchedule(JSON.parse(sc))
    } catch { /* ignore */ }
  }, [])

  const saveSeo = () => {
    localStorage.setItem(SEO_DEFAULTS_KEY, JSON.stringify(seo))
    showToast('✅ SEO 기본값 저장됨')
  }

  const saveSchedule = () => {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule))
    showToast('✅ 스케줄 설정 저장됨')
  }


  const toggleDay = (d: string) => {
    setSchedule(p => ({
      ...p,
      runDays: p.runDays.includes(d) ? p.runDays.filter(x => x !== d) : [...p.runDays, d]
    }))
  }

  const DAYS = [
    { id: 'mon', label: '월' }, { id: 'tue', label: '화' }, { id: 'wed', label: '수' },
    { id: 'thu', label: '목' }, { id: 'fri', label: '금' }, { id: 'sat', label: '토' }, { id: 'sun', label: '일' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar />

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: saved ? 'rgba(0,196,113,0.15)' : '#1a1a1a', border: `1px solid ${saved ? 'rgba(0,196,113,0.4)' : 'var(--border-light)'}`, color: saved ? 'var(--green)' : '#fff', padding: '10px 22px', borderRadius: 8, fontSize: 13, zIndex: 9999, animation: 'fadeUp 0.2s ease-out', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24, maxWidth: 760 }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>⚙️ 설정</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>API 키, 자동화 스케줄, SEO 기본값을 관리합니다</p>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px',
                fontSize: 13, color: tab === t.id ? 'var(--blue)' : 'var(--text-muted)',
                fontWeight: tab === t.id ? 700 : 400,
                borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >{t.icon} {t.label}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ─── API 설정 탭 ─── */}
          {tab === 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* 연결 상태 요약 */}
              <div className="card">
                <div className="sh" style={{ marginBottom: 12 }}>연결 상태</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Supabase (PostgreSQL)', ok: envStatus?.supabase, key: 'NEXT_PUBLIC_SUPABASE_URL' },
                    { label: 'Claude API (Anthropic)', ok: envStatus?.anthropic, key: 'ANTHROPIC_API_KEY' },
                  ].map(item => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`dot ${item.ok ? 'dot-green' : 'dot-red'}`} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.key}</div>
                        </div>
                      </div>
                      <span className={`badge ${item.ok ? 'badge-green' : 'badge-red'}`}>
                        {item.ok == null ? '확인 중' : item.ok ? '연결됨' : '미설정'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 안내 */}
              <div className="card" style={{ background: 'rgba(30,106,255,0.06)', borderColor: 'rgba(30,106,255,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', marginBottom: 10 }}>📝 API 키 설정 방법</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  프로젝트 루트의 <code style={{ background: 'var(--bg-input)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>.env.local</code> 파일에 아래 값을 입력하세요.
                  <br />변경 후 <strong>개발 서버를 재시작</strong>해야 반영됩니다 (<code style={{ background: 'var(--bg-input)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>npm run dev</code>).
                </div>
                <div style={{ marginTop: 12, background: 'var(--bg-base)', borderRadius: 6, padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 2 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}># Supabase</span></div>
                  <div>NEXT_PUBLIC_SUPABASE_URL=<span style={{ color: 'var(--yellow)' }}>https://xxx.supabase.co</span></div>
                  <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=<span style={{ color: 'var(--yellow)' }}>eyJ...</span></div>
                  <div>SUPABASE_SERVICE_ROLE_KEY=<span style={{ color: 'var(--yellow)' }}>eyJ...</span></div>
                  <div style={{ marginTop: 6 }}><span style={{ color: 'var(--text-muted)' }}># AI</span></div>
                  <div>ANTHROPIC_API_KEY=<span style={{ color: 'var(--yellow)' }}>sk-ant-...</span></div>
                </div>
              </div>

              <div className="card" style={{ background: 'rgba(255,184,0,0.05)', borderColor: 'rgba(255,184,0,0.2)' }}>
                <div style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 600, marginBottom: 6 }}>⚠️ 보안 주의</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  <code>.env.local</code>은 절대 Git에 커밋하지 마세요. <code>.gitignore</code>에 이미 포함되어 있습니다.
                </div>
              </div>
            </div>
          )}

          {/* ─── SEO 기본값 탭 ─── */}
          {tab === 'seo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card">
                <div className="sh" style={{ marginBottom: 14 }}>글 생성 기본값</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* 글자 수 범위 */}
                  <div>
                    <label className="label">글자 수 범위 (랜덤 생성)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input className="input" type="number" min="500" max="5000" step="100" value={seo.minWords} onChange={e => setSeo(p => ({ ...p, minWords: Number(e.target.value) }))} style={{ flex: 1 }} />
                      <span style={{ color: 'var(--text-muted)', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>~</span>
                      <input className="input" type="number" min="500" max="5000" step="100" value={seo.maxWords} onChange={e => setSeo(p => ({ ...p, maxWords: Number(e.target.value) }))} style={{ flex: 1 }} />
                    </div>
                  </div>

                  {/* 키워드 밀도 */}
                  <div>
                    <label className="label">키워드 밀도 (%)</label>
                    <select className="input" value={seo.keywordDensity} onChange={e => setSeo(p => ({ ...p, keywordDensity: e.target.value }))}>
                      <option value="0.5">0.5% — 매우 낮음</option>
                      <option value="1.0">1.0% — 낮음</option>
                      <option value="1.5">1.5% — 보통 (권장)</option>
                      <option value="2.0">2.0% — 높음</option>
                      <option value="2.5">2.5% — 매우 높음</option>
                    </select>
                  </div>


                  <hr />
                  <div className="sh">고정 SEO 옵션 (항상 포함)</div>

                  {[
                    { key: 'includeSchema', label: 'Schema Markup 힌트 (Article/FAQ)', desc: '구조화 데이터로 검색 결과 리치스니펫 향상' },
                    { key: 'includeFaq', label: 'FAQ 섹션 포함', desc: '사용자 질문에 답변하는 FAQ로 Featured Snippet 노출 증가' },
                    { key: 'includeDisclaimer', label: '면책 조항 포함 (YMYL)', desc: '의료/금융 콘텐츠에서 E-E-A-T 신호 강화' },
                  ].map(opt => (
                    <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 6 }}>
                      <div>
                        <div style={{ fontSize: 13 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
                      </div>
                      <div
                        onClick={() => setSeo(p => ({ ...p, [opt.key]: !p[opt.key as keyof typeof p] }))}
                        style={{ width: 36, height: 20, borderRadius: 10, background: seo[opt.key as keyof typeof seo] ? 'var(--blue)' : '#333', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, marginLeft: 12 }}
                      >
                        <div style={{ position: 'absolute', top: 2, left: seo[opt.key as keyof typeof seo] ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn-primary" style={{ width: 140 }} onClick={saveSeo}>💾 저장</button>
            </div>
          )}

          {/* ─── 시스템 정보 탭 ─── */}
          {tab === 'about' && (

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="sh" style={{ marginBottom: 12 }}>SEO Auto Writer</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: '버전',       val: 'v0.2.0' },
                    { label: '프레임워크', val: 'Next.js 15 (App Router)' },
                    { label: 'AI 모델',    val: 'claude-sonnet-4-5' },
                    { label: 'DB',         val: 'Supabase (PostgreSQL)' },
                    { label: '스타일',     val: 'Vanilla CSS' },
                    { label: '배포',       val: 'Vercel (예정)' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="sh" style={{ marginBottom: 12 }}>구현된 기능</div>
                {[
                  '✅ 글 생성 메인 폼 (다국어, 페르소나, SEO 옵션)',
                  '✅ SEO 프롬프트 30종 (E-E-A-T 기반)',
                  '✅ Claude API 연동 글 생성',
                  '✅ 게시글 예약 발행 시스템',
                  '✅ 발행 로그 페이지',
                  '✅ 페르소나 관리 (CRUD)',
                  '✅ 키워드 관리 (CRUD + 일괄 등록)',
                  '✅ 사이트 관리 (WP 연동 테스트)',
                  '⏳ WordPress 자동 포스팅 (사이트 준비 후)',
                  '⏳ 네이버 블로그 연동 (추후)',
                  '⏳ Cron 자동 스케줄러 (Vercel 배포 후)',
                ].map((item, i) => (
                  <div key={i} style={{ fontSize: 12, color: item.startsWith('✅') ? 'var(--text-secondary)' : 'var(--text-muted)', padding: '4px 0', lineHeight: 1.6 }}>{item}</div>
                ))}
              </div>

              <div className="card" style={{ background: 'rgba(30,106,255,0.06)', borderColor: 'rgba(30,106,255,0.2)' }}>
                <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, marginBottom: 8 }}>📚 참고 문서</div>
                {[
                  { label: 'Google SEO 스타터 가이드',  url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' },
                  { label: 'Google 품질 평가 가이드',   url: 'https://static.googleusercontent.com/media/guidelines.raterhub.com/ko//searchqualityevaluatorguidelines.pdf' },
                  { label: 'Supabase 문서',             url: 'https://supabase.com/docs' },
                  { label: 'Claude API 문서',           url: 'https://docs.anthropic.com' },
                ].map(link => (
                  <a key={link.label} href={link.url} target="_blank" rel="noreferrer"
                    style={{ display: 'block', fontSize: 12, color: 'var(--blue)', textDecoration: 'none', padding: '3px 0', opacity: 0.8 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                  >↗ {link.label}</a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
