'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { useLang } from '@/lib/language-context'

interface Keyword {
  id: string
  keyword: string
  language: 'en' | 'ko' | 'ja'
  category: string
  search_intent: string
  priority: number
  is_active: boolean
  used_count: number
  created_at: string
}

interface Summary {
  total: number
  active: number
  en: number
  ko: number
  ja: number
  totalUses: number
}

const LANG_LABELS: Record<string, string> = { en: 'EN', ko: 'KR', ja: 'JP' }
const LANG_COLORS: Record<string, string> = { en: 'badge-blue', ko: 'badge-green', ja: 'badge-yellow' }
const INTENT_LABELS: Record<string, string> = {
  informational: '정보성',
  navigational: '탐색형',
  transactional: '거래형',
  commercial: '상업형',
}

const CATEGORIES = [
  'health', 'skin-care', 'supplements', 'beauty',
  'medical-procedure', 'dental', 'diet-clinic',
  'anti-aging', 'cancer-prevention', 'mental-health',
  'medical-tourism', 'lifestyle', 'functional-food', '기타',
]
const INTENT_LIST = ['informational', 'navigational', 'transactional', 'commercial']

const EMPTY_FORM: {
  keyword: string
  language: 'en' | 'ko' | 'ja'
  category: string
  search_intent: string
  priority: number
  is_active: boolean
} = {
  keyword: '',
  language: 'en',
  category: 'health',
  search_intent: 'informational',
  priority: 3,
  is_active: true,
}

export default function KeywordsPage() {
  const { lang } = useLang()
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterLang, setFilterLang] = useState<string>(lang)
  const [filterCat, setFilterCat] = useState('all')

  // 전역 언어 변경 시 자동 동기화
  useEffect(() => { setFilterLang(lang) }, [lang])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Keyword | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [bulkText, setBulkText] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchKeywords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ lang: filterLang, category: filterCat, limit: '500' })
      const res = await fetch(`/api/keywords?${params}`)
      const json = await res.json()
      setKeywords(json.keywords || [])
      setSummary(json.summary || null)
    } catch {
      showToast('키워드 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [filterLang, filterCat])

  useEffect(() => { fetchKeywords() }, [fetchKeywords])

  const filtered = keywords.filter(k => {
    if (!search) return true
    return k.keyword.toLowerCase().includes(search.toLowerCase()) || k.category.toLowerCase().includes(search.toLowerCase())
  })

  const handleSave = async () => {
    if (!form.keyword.trim()) return showToast('키워드를 입력하세요')
    setSaving(true)
    try {
      if (editMode && selected) {
        await fetch('/api/keywords', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selected.id, ...form }),
        })
        showToast('수정 완료')
      } else {
        await fetch('/api/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        showToast('키워드 추가됨')
      }
      setShowForm(false)
      setEditMode(false)
      setForm({ ...EMPTY_FORM })
      setSelected(null)
      fetchKeywords()
    } catch {
      showToast('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkSave = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return showToast('키워드를 입력하세요')
    setSaving(true)
    try {
      const payload = lines.map(kw => ({
        keyword: kw,
        language: form.language,
        category: form.category,
        search_intent: form.search_intent,
        priority: form.priority,
        is_active: true,
      }))
      await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      showToast(`${lines.length}개 키워드 추가됨`)
      setBulkText('')
      setBulkMode(false)
      setShowForm(false)
      fetchKeywords()
    } catch {
      showToast('일괄 저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 키워드를 삭제하시겠습니까?')) return
    setDeleting(true)
    try {
      await fetch('/api/keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      showToast('삭제됨')
      if (selected?.id === id) setSelected(null)
      fetchKeywords()
    } catch {
      showToast('삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (k: Keyword) => {
    await fetch('/api/keywords', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: k.id, is_active: !k.is_active }),
    })
    showToast(k.is_active ? '비활성화됨' : '활성화됨')
    fetchKeywords()
  }

  const openEdit = (k: Keyword) => {
    setForm({
      keyword: k.keyword,
      language: k.language,
      category: k.category,
      search_intent: k.search_intent,
      priority: k.priority,
      is_active: k.is_active,
    })
    setEditMode(true)
    setSelected(k)
    setBulkMode(false)
    setShowForm(true)
  }

  const openAdd = () => {
    setForm({ ...EMPTY_FORM })
    setEditMode(false)
    setSelected(null)
    setBulkMode(false)
    setShowForm(true)
  }

  const priorityColor = (p: number) => {
    if (p >= 5) return 'var(--red)'
    if (p >= 4) return 'var(--yellow)'
    if (p >= 3) return 'var(--blue)'
    return 'var(--text-muted)'
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', border: '1px solid var(--border-light)', color: '#fff',
          padding: '10px 22px', borderRadius: 8, fontSize: 13, zIndex: 9999,
          animation: 'fadeUp 0.2s ease-out', whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>{toast}</div>
      )}

      {/* 메인 영역 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* 왼쪽: 리스트 영역 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24 }}>

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>🔑 키워드 관리</h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>SEO 타겟 키워드 풀을 등록하고 관리합니다</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { openAdd(); setBulkMode(true) }}>
                📋 일괄 등록
              </button>
              <button className="btn-primary" style={{ fontSize: 13 }} onClick={openAdd}>
                + 키워드 추가
              </button>
            </div>
          </div>

          {/* 통계 카드 */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: '전체', val: summary.total, color: 'var(--text-primary)' },
                { label: '활성', val: summary.active, color: 'var(--green)' },
                { label: 'EN', val: summary.en, color: 'var(--blue)' },
                { label: 'KR', val: summary.ko, color: 'var(--green)' },
                { label: 'JP', val: summary.ja, color: 'var(--yellow)' },
                { label: '누적 사용', val: summary.totalUses, color: 'var(--text-secondary)' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ textAlign: 'center', padding: '12px 8px' }}>
                  <div className="stat-num count-up" style={{ color: s.color, fontSize: 22 }}>{s.val}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* 필터 바 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              className="input"
              placeholder="🔍 키워드 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <select className="input" value={filterLang} onChange={e => setFilterLang(e.target.value)} style={{ width: 110 }}>
              <option value="all">전체 언어</option>
              <option value="en">🇺🇸 English</option>
              <option value="ko">🇰🇷 한국어</option>
              <option value="ja">🇯🇵 日本語</option>
            </select>
            <select className="input" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 120 }}>
              <option value="all">전체 카테고리</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
              {filtered.length}건
            </div>
          </div>

          {/* 테이블 헤더 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 60px 100px 100px 80px 70px 80px',
            padding: '6px 12px',
            fontSize: 11,
            color: 'var(--text-muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            borderBottom: '1px solid var(--border)',
            marginBottom: 4,
          }}>
            <span style={{ textAlign: 'center' }}>#</span>
            <span>키워드</span>
            <span>언어</span>
            <span>카테고리</span>
            <span>검색의도</span>
            <span>우선순위</span>
            <span>활성</span>
            <span>작업</span>
          </div>

          {/* 키워드 목록 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                불러오는 중...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                키워드가 없습니다
              </div>
            ) : filtered.map((k, idx) => (
              <div
                key={k.id}
                onClick={() => setSelected(k)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 60px 100px 100px 80px 70px 80px',
                  padding: '9px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  alignItems: 'center',
                  background: selected?.id === k.id ? 'var(--bg-hover)' : 'transparent',
                  border: selected?.id === k.id ? '1px solid var(--border-light)' : '1px solid transparent',
                  marginBottom: 2,
                  transition: 'all 0.1s',
                  opacity: k.is_active ? 1 : 0.5,
                }}
                className="fade-up"
              >
                <span style={{
                  fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
                  textAlign: 'center', fontFamily: 'monospace',
                }}>{idx + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {k.keyword}
                  {k.used_count > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>×{k.used_count}</span>
                  )}
                </span>
                <span>
                  <span className={`badge ${LANG_COLORS[k.language]}`} style={{ fontSize: 10 }}>
                    {LANG_LABELS[k.language]}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{k.category}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{INTENT_LABELS[k.search_intent] || k.search_intent}</span>
                <span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: priorityColor(k.priority),
                    background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4,
                  }}>P{k.priority}</span>
                </span>
                <span>
                  <div
                    onClick={e => { e.stopPropagation(); handleToggleActive(k) }}
                    style={{
                      width: 32, height: 18, borderRadius: 9,
                      background: k.is_active ? 'var(--green)' : '#333',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: k.is_active ? 14 : 2,
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn-ghost"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); openEdit(k) }}
                  >수정</button>
                  <button
                    className="btn-ghost"
                    style={{ padding: '3px 8px', fontSize: 11, color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                    onClick={e => { e.stopPropagation(); handleDelete(k.id) }}
                    disabled={deleting}
                  >삭제</button>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 등록/편집 폼 or 상세 패널 */}
        <div style={{
          width: showForm ? 340 : (selected ? 300 : 0),
          minWidth: showForm ? 340 : (selected ? 300 : 0),
          borderLeft: '1px solid var(--border)',
          overflow: 'hidden',
          transition: 'width 0.2s, min-width 0.2s',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* 등록/편집 폼 */}
          {showForm ? (
            <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>
                  {bulkMode ? '📋 일괄 등록' : editMode ? '✏️ 키워드 수정' : '+ 키워드 추가'}
                </h2>
                <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }}
                  onClick={() => { setShowForm(false); setEditMode(false); setBulkMode(false) }}>✕</button>
              </div>

              {/* 공통 필드 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">언어</label>
                  <select className="input" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value as 'en'|'ko'|'ja' }))}>
                    <option value="en">English (Google)</option>
                    <option value="ko">한국어 (Naver)</option>
                    <option value="ja">日本語 (Yahoo)</option>
                  </select>
                </div>
                <div>
                  <label className="label">카테고리</label>
                  <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">검색 의도</label>
                  <select className="input" value={form.search_intent} onChange={e => setForm(p => ({ ...p, search_intent: e.target.value }))}>
                    {INTENT_LIST.map(i => <option key={i} value={i}>{INTENT_LABELS[i]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">우선순위 (1~5) — 현재: P{form.priority}</label>
                  <input type="range" min="1" max="5" step="1" value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: priorityColor(form.priority) }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                    {[1,2,3,4,5].map(n => <span key={n}>P{n}</span>)}
                  </div>
                </div>

                {/* 일괄 등록 텍스트 입력 */}
                {bulkMode ? (
                  <div>
                    <label className="label">키워드 목록 (줄바꿈으로 구분)</label>
                    <textarea
                      className="input"
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      rows={10}
                      placeholder={"best protein powder\nhealthy meal prep\nweight loss tips\n..."}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {bulkText.split('\n').filter(l => l.trim()).length}개 키워드
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="label">키워드</label>
                    <input
                      className="input"
                      value={form.keyword}
                      onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))}
                      placeholder="예: best protein powder for weight loss"
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                    />
                  </div>
                )}

                {!bulkMode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="kw-active" checked={form.is_active}
                      onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                    <label htmlFor="kw-active" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>활성 상태</label>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={bulkMode ? handleBulkSave : handleSave}
                  disabled={saving}
                >
                  {saving ? <><span className="spinner" /> 저장 중...</> : bulkMode ? '일괄 등록' : editMode ? '수정 완료' : '추가'}
                </button>
                <button className="btn-ghost" onClick={() => { setShowForm(false); setEditMode(false); setBulkMode(false) }}>취소</button>
              </div>
            </div>

          ) : selected ? (
            /* 상세 패널 */
            <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span className="sh">키워드 상세</span>
                <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }}
                  onClick={() => setSelected(null)}>✕</button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, wordBreak: 'break-all' }}>
                  {selected.keyword}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className={`badge ${LANG_COLORS[selected.language]}`}>{LANG_LABELS[selected.language]}</span>
                  <span className="badge badge-gray">{selected.category}</span>
                  <span className="badge badge-gray">{INTENT_LABELS[selected.search_intent]}</span>
                  <span className="badge" style={{
                    background: 'rgba(0,0,0,0.3)',
                    color: priorityColor(selected.priority),
                    border: `1px solid ${priorityColor(selected.priority)}44`,
                  }}>P{selected.priority}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {[
                  { label: '상태', val: selected.is_active ? '✅ 활성' : '⛔ 비활성' },
                  { label: '사용 횟수', val: `${selected.used_count}회` },
                  { label: '등록일', val: new Date(selected.created_at).toLocaleDateString('ko-KR') },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.val}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn-primary" style={{ width: '100%' }} onClick={() => openEdit(selected)}>
                  ✏️ 수정
                </button>
                <button
                  className="btn-ghost"
                  style={{ width: '100%' }}
                  onClick={() => handleToggleActive(selected)}
                >
                  {selected.is_active ? '⛔ 비활성화' : '✅ 활성화'}
                </button>
                <button
                  className="btn-ghost"
                  style={{ width: '100%', color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                  onClick={() => handleDelete(selected.id)}
                  disabled={deleting}
                >
                  🗑 삭제
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
