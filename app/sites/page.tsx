'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { useLang } from '@/lib/language-context'

interface Site {
  id: string
  name: string
  url: string
  language: 'en' | 'ko' | 'ja'
  category: string
  wp_url: string
  wp_username: string
  wp_app_password: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Summary { total: number; active: number; en: number; ko: number; ja: number }

const LANG_LABELS: Record<string, string> = { en: 'EN', ko: 'KR', ja: 'JP' }
const LANG_COLORS: Record<string, string> = { en: 'badge-blue', ko: 'badge-green', ja: 'badge-yellow' }
const LANG_NAMES: Record<string, string> = { en: 'English (Google)', ko: '한국어 (Naver)', ja: '日本語 (Yahoo)' }
const CATEGORIES = ['health', 'beauty', 'finance', 'tech', 'lifestyle', 'food', 'travel', 'education', 'business', '기타']

const EMPTY_FORM = {
  name: '', url: '', language: 'en' as 'en'|'ko'|'ja',
  category: 'health', wp_url: '', wp_username: '', wp_app_password: '', is_active: true,
}

export default function SitesPage() {
  const { lang } = useLang()
  const [sites, setSites] = useState<Site[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterLang, setFilterLang] = useState<string>(lang)
  const [filterActive, setFilterActive] = useState('all')

  // 전역 언어 변경 시 필터 동기화
  useEffect(() => { setFilterLang(lang) }, [lang])
  const [selected, setSelected] = useState<Site | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const fetchSites = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ lang: filterLang, active: filterActive })
      const res = await fetch(`/api/sites?${p}`)
      const json = await res.json()
      setSites(json.sites || [])
      setSummary(json.summary || null)
    } catch { showToast('사이트 불러오기 실패') }
    finally { setLoading(false) }
  }, [filterLang, filterActive])

  useEffect(() => { fetchSites() }, [fetchSites])

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) return showToast('사이트명과 URL을 입력하세요')
    setSaving(true)
    try {
      if (editMode && selected) {
        await fetch('/api/sites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...form }) })
        showToast('수정 완료')
      } else {
        await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        showToast('사이트 추가됨')
      }
      setShowForm(false); setEditMode(false); setForm({ ...EMPTY_FORM }); setSelected(null); setTestResult(null)
      fetchSites()
    } catch { showToast('저장 실패') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 사이트를 삭제하시겠습니까?\n관련 발행 로그의 사이트 정보도 해제됩니다.')) return
    await fetch('/api/sites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    showToast('삭제됨')
    if (selected?.id === id) setSelected(null)
    fetchSites()
  }

  const handleToggle = async (s: Site) => {
    await fetch('/api/sites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, is_active: !s.is_active }) })
    showToast(s.is_active ? '비활성화됨' : '활성화됨')
    fetchSites()
  }

  // WordPress 연결 테스트 (서버 사이드 프록시 — CORS 차단 방지)
  const handleWpTest = async () => {
    if (!form.wp_url || !form.wp_username || !form.wp_app_password) return showToast('WordPress 정보를 모두 입력하세요')
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/sites/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wp_url:          form.wp_url,
          wp_username:     form.wp_username,
          wp_app_password: form.wp_app_password,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTestResult({
          ok: true,
          msg: `✅ 연결 성공!\n사이트: ${data.siteName || ''}\n사용자: ${data.userName || ''}\nWP 버전: ${data.wpVersion || ''}`,
        })
      } else {
        setTestResult({ ok: false, msg: `❌ ${data.message || '연결 실패'}` })
      }
    } catch {
      setTestResult({ ok: false, msg: '❌ 네트워크 오류 — 앱 서버가 실행 중인지 확인하세요' })
    } finally { setTesting(false) }
  }

  const openEdit = (s: Site) => {
    setForm({ name: s.name, url: s.url, language: s.language, category: s.category, wp_url: s.wp_url, wp_username: s.wp_username, wp_app_password: s.wp_app_password, is_active: s.is_active })
    setEditMode(true); setSelected(s); setShowForm(true); setTestResult(null); setShowPwd(false)
  }

  const openAdd = () => {
    setForm({ ...EMPTY_FORM }); setEditMode(false); setSelected(null); setShowForm(true); setTestResult(null); setShowPwd(false)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar />

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '1px solid var(--border-light)', color: '#fff', padding: '10px 22px', borderRadius: 8, fontSize: 13, zIndex: 9999, animation: 'fadeUp 0.2s ease-out', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* 사이트 목록 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>🌐 사이트 관리</h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>WordPress 사이트를 등록하고 자동 발행 연동을 설정합니다</p>
            </div>
            <button className="btn-primary" style={{ fontSize: 13 }} onClick={openAdd}>+ 사이트 추가</button>
          </div>

          {/* 통계 */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: '전체', val: summary.total, color: 'var(--text-primary)' },
                { label: '활성', val: summary.active, color: 'var(--green)' },
                { label: 'EN', val: summary.en, color: 'var(--blue)' },
                { label: 'KR', val: summary.ko, color: 'var(--green)' },
                { label: 'JP', val: summary.ja, color: 'var(--yellow)' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-num count-up" style={{ color: s.color }}>{s.val}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* 필터 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select className="input" value={filterLang} onChange={e => setFilterLang(e.target.value)} style={{ width: 130 }}>
              <option value="all">전체 언어</option>
              <option value="en">English</option>
              <option value="ko">한국어</option>
              <option value="ja">日本語</option>
            </select>
            <select className="input" value={filterActive} onChange={e => setFilterActive(e.target.value)} style={{ width: 110 }}>
              <option value="all">전체 상태</option>
              <option value="true">활성만</option>
              <option value="false">비활성만</option>
            </select>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>{sites.length}개 사이트</div>
          </div>

          {/* 사이트 카드 그리드 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} /> 불러오는 중...
              </div>
            ) : sites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>등록된 사이트가 없습니다</div>
                <div style={{ fontSize: 12, marginBottom: 20 }}>WordPress 사이트를 추가하여 자동 발행을 시작하세요</div>
                <button className="btn-primary" onClick={openAdd}>+ 첫 번째 사이트 추가</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {sites.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="card fade-up"
                    style={{
                      cursor: 'pointer',
                      border: selected?.id === s.id ? '1px solid var(--blue)' : '1px solid var(--border)',
                      opacity: s.is_active ? 1 : 0.55,
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    {/* 활성 도트 */}
                    <div style={{ position: 'absolute', top: 14, right: 14 }}>
                      <span className={`dot ${s.is_active ? 'dot-green' : 'dot-gray'}`} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        🌐
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      <span className={`badge ${LANG_COLORS[s.language]}`}>{LANG_LABELS[s.language]}</span>
                      <span className="badge badge-gray">{s.category}</span>
                      {s.wp_url && <span className="badge badge-green" style={{ fontSize: 10 }}>WP 연동</span>}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost" style={{ flex: 1, fontSize: 12, padding: '5px 0' }}
                        onClick={e => { e.stopPropagation(); openEdit(s) }}>✏️ 수정</button>
                      <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); handleToggle(s) }}>
                        {s.is_active ? '⛔' : '✅'}
                      </button>
                      <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                        onClick={e => { e.stopPropagation(); handleDelete(s.id) }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 패널: 등록/편집 폼 */}
        {showForm && (
          <div style={{ width: 360, borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>{editMode ? '✏️ 사이트 수정' : '+ 사이트 추가'}</h2>
              <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => { setShowForm(false); setEditMode(false); setTestResult(null) }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 기본 정보 */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>기본 정보</div>
              <div>
                <label className="label">사이트명 *</label>
                <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예: HealthEN Blog 1" />
              </div>
              <div>
                <label className="label">사이트 URL *</label>
                <input className="input" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://myblog.com" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">타겟 언어</label>
                  <select className="input" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value as 'en'|'ko'|'ja' }))}>
                    <option value="en">English</option>
                    <option value="ko">한국어</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
                <div>
                  <label className="label">카테고리</label>
                  <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <hr />

              {/* WordPress 연동 */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>WordPress 연동</div>
              <div style={{ background: 'var(--bg-input)', borderRadius: 6, padding: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                💡 WP 대시보드 → 사용자 → 프로필 → Application Passwords에서 발급
              </div>
              <div>
                <label className="label">WP REST API URL</label>
                <input className="input" value={form.wp_url} onChange={e => setForm(p => ({ ...p, wp_url: e.target.value }))} placeholder="https://myblog.com/wp-json/wp/v2" />
              </div>
              <div>
                <label className="label">관리자 아이디</label>
                <input className="input" value={form.wp_username} onChange={e => setForm(p => ({ ...p, wp_username: e.target.value }))} placeholder="admin" />
              </div>
              <div>
                <label className="label">Application Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input" type={showPwd ? 'text' : 'password'}
                    value={form.wp_app_password} onChange={e => setForm(p => ({ ...p, wp_app_password: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    style={{ paddingRight: 40 }}
                  />
                  <button onClick={() => setShowPwd(p => !p)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {/* 연결 테스트 */}
              <button className="btn-ghost" onClick={handleWpTest} disabled={testing} style={{ fontSize: 12 }}>
                {testing ? <><span className="spinner" /> 테스트 중...</> : '🔌 WordPress 연결 테스트'}
              </button>
              {testResult && (
                <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, background: testResult.ok ? 'rgba(0,196,113,0.1)' : 'rgba(255,68,68,0.1)', color: testResult.ok ? 'var(--green)' : 'var(--red)', border: `1px solid ${testResult.ok ? 'rgba(0,196,113,0.3)' : 'rgba(255,68,68,0.3)'}`, whiteSpace: 'pre-line', lineHeight: 1.8 }}>
                  {testResult.msg}
                </div>
              )}

              <hr />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="site-active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                <label htmlFor="site-active" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>활성 상태 (발행 대상에 포함)</label>
              </div>
            </div>

            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner" /> 저장 중...</> : editMode ? '수정 완료' : '사이트 추가'}
              </button>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setEditMode(false); setTestResult(null) }}>취소</button>
            </div>
          </div>
        )}

        {/* 선택 상세 (폼 없을 때) */}
        {!showForm && selected && (
          <div style={{ width: 280, borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', padding: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="sh">사이트 상세</span>
              <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{selected.name}</div>
            <a href={selected.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none', display: 'block', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.url} ↗
            </a>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <span className={`badge ${LANG_COLORS[selected.language]}`}>{LANG_LABELS[selected.language]}</span>
              <span className="badge badge-gray">{selected.category}</span>
            </div>

            {[
              { label: '타겟 언어', val: LANG_NAMES[selected.language] },
              { label: '상태', val: selected.is_active ? '✅ 활성' : '⛔ 비활성' },
              { label: 'WP 연동', val: selected.wp_url ? '✅ 설정됨' : '❌ 미설정' },
              { label: '등록일', val: new Date(selected.created_at).toLocaleDateString('ko-KR') },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{item.val}</span>
              </div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => openEdit(selected)}>✏️ 수정</button>
              <button className="btn-ghost" style={{ width: '100%' }} onClick={() => handleToggle(selected)}>{selected.is_active ? '⛔ 비활성화' : '✅ 활성화'}</button>
              <button className="btn-ghost" style={{ width: '100%', color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }} onClick={() => handleDelete(selected.id)}>🗑 삭제</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
