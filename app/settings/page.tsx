'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'

interface EnvStatus {
  supabase: boolean
  anthropic: boolean
  gemini: boolean
}

type TabId = 'api' | 'schedule' | 'seo' | 'image' | 'about'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'api',      icon: '🔑', label: 'API 설정' },
  { id: 'schedule', icon: '⏰', label: '자동화 스케줄' },
  { id: 'seo',      icon: '📈', label: 'SEO 기본값' },
  { id: 'image',    icon: '🖼️',  label: '이미지 설정' },
  { id: 'about',    icon: 'ℹ️',  label: '시스템 정보' },
]

const SEO_DEFAULTS_KEY = 'seo_defaults'
const SCHEDULE_KEY = 'schedule_settings'
const IMAGE_SETTINGS_KEY = 'image_settings'

const DEFAULT_IMAGE = {
  generateImage: true,          // 글 발행 시 카드 이미지 자동 생성 (개수는 1~8개 랜덤)
  imageStyle: 'card-wide',      // card-wide(1200×630) · card-square(1080×1080)
  showSubtitle: true,           // 서브타이틀(키워드) 표시
  showPoints: true,             // 핵심 포인트 3개 표시
  showSiteName: true,           // 사이트명 표시
}

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
  const [imageSettings, setImageSettings] = useState({ ...DEFAULT_IMAGE })
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
      const img = localStorage.getItem(IMAGE_SETTINGS_KEY)
      if (img) setImageSettings(JSON.parse(img))
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

  const saveImage = () => {
    localStorage.setItem(IMAGE_SETTINGS_KEY, JSON.stringify(imageSettings))
    showToast('✅ 이미지 설정 저장됨')
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
                    { label: 'Gemini API (Google)', ok: envStatus?.gemini, key: 'GEMINI_API_KEY' },
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
                  <div>GEMINI_API_KEY=<span style={{ color: 'var(--yellow)' }}>AIza...</span></div>
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

          {/* ─── 자동화 스케줄 탭 ─── */}
          {tab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <div className="card">
                <div className="sh" style={{ marginBottom: 14 }}>자동 발행 스케줄</div>

                {/* 활성화 토글 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '12px 14px', background: 'var(--bg-input)', borderRadius: 8, border: schedule.enabled ? '1px solid rgba(0,196,113,0.3)' : '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>자동 발행 활성화</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Cron job 기반 예약 글 자동 발행</div>
                  </div>
                  <div onClick={() => setSchedule(p => ({ ...p, enabled: !p.enabled }))}
                    style={{ width: 44, height: 24, borderRadius: 12, background: schedule.enabled ? 'var(--green)' : '#333', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: schedule.enabled ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: schedule.enabled ? 1 : 0.45, pointerEvents: schedule.enabled ? 'auto' : 'none' }}>
                  {/* 일일 발행 한도 */}
                  <div>
                    <label className="label">일일 최대 발행 수 — {schedule.dailyLimit}개/일</label>
                    <input type="range" min="1" max="20" step="1" value={schedule.dailyLimit}
                      onChange={e => setSchedule(p => ({ ...p, dailyLimit: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: 'var(--blue)', marginBottom: 4 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>1개</span><span>10개</span><span>20개</span>
                    </div>
                  </div>

                  {/* 발행 시간대 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">발행 시작 시각</label>
                      <select className="input" value={schedule.startHour} onChange={e => setSchedule(p => ({ ...p, startHour: Number(e.target.value) }))}>
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">발행 종료 시각</label>
                      <select className="input" value={schedule.endHour} onChange={e => setSchedule(p => ({ ...p, endHour: Number(e.target.value) }))}>
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                    </div>
                  </div>

                  {/* 랜덤 딜레이 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 13 }}>±{schedule.delayMinutes}분 랜덤 딜레이</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>자연스러운 발행 패턴으로 스팸 감지 회피</div>
                    </div>
                    <div onClick={() => setSchedule(p => ({ ...p, randomDelay: !p.randomDelay }))}
                      style={{ width: 36, height: 20, borderRadius: 10, background: schedule.randomDelay ? 'var(--blue)' : '#333', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 2, left: schedule.randomDelay ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </div>
                  </div>

                  {/* 발행 요일 */}
                  <div>
                    <label className="label">발행 요일</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {DAYS.map(d => (
                        <button key={d.id} onClick={() => toggleDay(d.id)}
                          style={{ flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', border: schedule.runDays.includes(d.id) ? '1px solid var(--blue)' : '1px solid var(--border)', background: schedule.runDays.includes(d.id) ? 'var(--blue-dim)' : 'var(--bg-input)', color: schedule.runDays.includes(d.id) ? 'var(--blue)' : 'var(--text-muted)' }}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 타임존 */}
                  <div>
                    <label className="label">타임존</label>
                    <select className="input" value={schedule.timezone} onChange={e => setSchedule(p => ({ ...p, timezone: e.target.value }))}>
                      <option value="Asia/Seoul">Asia/Seoul (KST +09:00)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST +09:00)</option>
                      <option value="America/New_York">America/New_York (EST -05:00)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST -08:00)</option>
                      <option value="Europe/London">Europe/London (GMT ±00:00)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="card" style={{ background: 'rgba(255,184,0,0.05)', borderColor: 'rgba(255,184,0,0.2)' }}>
                <div style={{ fontSize: 12, color: 'var(--yellow)', fontWeight: 600, marginBottom: 6 }}>⚙️ Cron Job 설정 필요</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  자동 실행을 위해 Vercel Cron 또는 외부 스케줄러에서 아래 엔드포인트를 호출하세요:<br />
                  <code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 3 }}>POST /api/cron/publish</code>
                </div>
              </div>

              <button className="btn-primary" style={{ width: 140 }} onClick={saveSchedule}>💾 저장</button>
            </div>
          )}

          {/* ─── SEO 기본값 탭 ─── */}
          {tab === 'seo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card">
                <div className="sh" style={{ marginBottom: 14 }}>글 생성 기본값</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* 글자 수 범위 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">최소 글자 수</label>
                      <input className="input" type="number" min="500" max="5000" step="100" value={seo.minWords} onChange={e => setSeo(p => ({ ...p, minWords: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">최대 글자 수</label>
                      <input className="input" type="number" min="500" max="5000" step="100" value={seo.maxWords} onChange={e => setSeo(p => ({ ...p, maxWords: Number(e.target.value) }))} />
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

                  {/* 기본 언어 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">기본 언어</label>
                      <select className="input" value={seo.defaultLang} onChange={e => setSeo(p => ({ ...p, defaultLang: e.target.value }))}>
                        <option value="en">English</option>
                        <option value="ko">한국어</option>
                        <option value="ja">日本語</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">기본 콘텐츠 타입</label>
                      <select className="input" value={seo.defaultContentType} onChange={e => setSeo(p => ({ ...p, defaultContentType: e.target.value }))}>
                        <option value="informational">정보성</option>
                        <option value="comparison">비교형</option>
                        <option value="howto">How-to</option>
                        <option value="listicle">리스트형</option>
                      </select>
                    </div>
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


          {/* ─── 이미지 설정 탭 ─── */}
          {tab === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* 이미지 자동 생성 ON/OFF */}
              <div className="card">
                <div className="sh" style={{ marginBottom: 16 }}>글 발행 시 이미지 자동 생성</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', background: imageSettings.generateImage ? 'rgba(30,106,255,0.08)' : '#111',
                  border: `1px solid ${imageSettings.generateImage ? 'rgba(30,106,255,0.3)' : 'var(--border)'}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                }} onClick={() => setImageSettings(p => ({ ...p, generateImage: !p.generateImage }))}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: imageSettings.generateImage ? '#fff' : '#666', marginBottom: 4 }}>
                      🖼️ 카드 이미지 자동 생성
                    </div>
                    <div style={{ fontSize: 11, color: '#555' }}>
                      글 발행 시 {1200}×630 카드 썸네일을 자동 생성하여 대표 이미지로 설정합니다
                    </div>
                  </div>
                  <div style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: imageSettings.generateImage ? '#1E6AFF' : '#2a2a2a',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: imageSettings.generateImage ? 22 : 2,
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                </div>
              </div>


              {/* 이미지 스타일 선택 */}
              {imageSettings.generateImage && (

                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div className="sh">이미지 스타일</div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                      background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
                      borderRadius: 20, fontSize: 11, color: '#a78bfa', fontWeight: 700,
                    }}>
                      🎲 글당 이미지 수: <span style={{ color: '#c4b5fd' }}>1~8개 랜덤</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    {[
                      { id: 'card-wide', label: '와이드 카드', size: '1200 × 630', desc: 'SNS / 블로그 썸네일 최적', emoji: '🖼️' },
                      { id: 'card-square', label: '스퀘어 카드', size: '1080 × 1080', desc: '인스타그램 최적화', emoji: '⬛' },
                    ].map(style => (
                      <div key={style.id}
                        onClick={() => setImageSettings(p => ({ ...p, imageStyle: style.id }))}
                        style={{
                          padding: 14, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                          background: imageSettings.imageStyle === style.id ? 'rgba(30,106,255,0.12)' : '#111',
                          border: `2px solid ${imageSettings.imageStyle === style.id ? '#1E6AFF' : 'var(--border)'}`,
                        }}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{style.emoji}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 2 }}>{style.label}</div>
                        <div style={{ fontSize: 11, color: '#1E6AFF', marginBottom: 4 }}>{style.size}</div>
                        <div style={{ fontSize: 10, color: '#555' }}>{style.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* 표시 옵션 */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>표시 옵션</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { key: 'showSubtitle', label: '서브타이틀 (키워드 텍스트)' },
                      { key: 'showPoints', label: '핵심 포인트 (카테고리 · 발행일 · 사이트명)' },
                      { key: 'showSiteName', label: '하단 사이트명 표시' },
                    ].map(opt => (
                      <label key={opt.key} style={{
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                        padding: '8px 12px', borderRadius: 6, background: '#111', border: '1px solid var(--border)',
                      }}>
                        <input type="checkbox"
                          checked={imageSettings[opt.key as keyof typeof imageSettings] as boolean}
                          onChange={e => setImageSettings(p => ({ ...p, [opt.key]: e.target.checked }))}
                          style={{ accentColor: '#1E6AFF', width: 14, height: 14 }} />
                        <span style={{ fontSize: 12, color: '#aaa' }}>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 카드 미리보기 */}
              {imageSettings.generateImage && (
                <div className="card">
                  <div className="sh" style={{ marginBottom: 12 }}>카드 스타일 미리보기</div>
                  <div style={{
                    background: 'linear-gradient(135deg, #0D1B2A, #1B3A4B)',
                    borderRadius: 10, padding: '20px 24px', position: 'relative', overflow: 'hidden',
                    border: '1px solid rgba(79,195,247,0.2)',
                    aspectRatio: imageSettings.imageStyle === 'card-wide' ? '1200/630' : '1/1',
                    maxHeight: 220,
                    display: 'flex', alignItems: 'center', gap: 20,
                  }}>
                    {/* 왼쪽 원형 장식 */}
                    <div style={{ flexShrink: 0, width: 70, height: 70, borderRadius: '50%',
                      background: 'rgba(79,195,247,0.15)', border: '2px solid rgba(79,195,247,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                      ✚
                    </div>
                    {/* 오른쪽 텍스트 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, background: '#1976D2', color: '#fff', padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 8 }}>SKIN-CARE</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 6 }}>글 제목이 여기에 표시됩니다</div>
                      {imageSettings.showSubtitle && <div style={{ fontSize: 11, color: 'rgba(79,195,247,0.8)', marginBottom: 8 }}>키워드 텍스트</div>}
                      {imageSettings.showPoints && (
                        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#888' }}>
                          <span>카테고리</span><span>발행일</span><span>사이트명</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 8, textAlign: 'center' }}>
                    실제 이미지는 카테고리별 색상 테마가 자동 적용됩니다
                  </div>
                </div>
              )}

              <button className="btn-primary" style={{ width: 140 }} onClick={saveImage}>💾 저장</button>
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
