'use client'
import { useState, useEffect, useCallback } from 'react'

interface ScheduledLog {
  id: string
  site_id: string
  sites?: { name: string; url: string } | null
  keyword_text: string
  title: string
  language: string
  category: string
  scheduled_at: string | null
  status: 'scheduled' | 'pending' | 'published' | 'failed'
  created_at: string
}

const LANG_FLAGS: Record<string, string> = { en: '🇺🇸', ko: '🇰🇷', ja: '🇯🇵' }

export default function SchedulePage() {
  const [logs, setLogs]           = useState<ScheduledLog[]>([])
  const [loading, setLoading]     = useState(true)
  const [checked, setChecked]     = useState<Set<string>>(new Set())
  const [deleting, setDeleting]   = useState(false)
  const [msg, setMsg]             = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterSite, setFilterSite] = useState('all')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      // scheduled + pending 모두 조회 (발행 대기 중인 글 전체)
      const [r1, r2] = await Promise.all([
        fetch('/api/logs?status=scheduled&limit=500'),
        fetch('/api/logs?status=pending&limit=500'),
      ])
      const d1 = await r1.json()
      const d2 = await r2.json()
      const combined = [...(d1.logs || []), ...(d2.logs || [])]
      // scheduled_at 기준 정렬
      combined.sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))
      setLogs(combined)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // 필터 적용
  const sites = Array.from(new Set(logs.map(l => l.sites?.name || l.site_id).filter(Boolean)))
  const filtered = logs.filter(l => {
    const dateMatch = !filterDate || (l.scheduled_at || '').startsWith(filterDate)
    const siteMatch = filterSite === 'all' || (l.sites?.name || l.site_id) === filterSite
    return dateMatch && siteMatch
  })

  // 오늘 예약된 글
  const today = new Date().toISOString().slice(0, 10)
  const todayLogs = logs.filter(l => (l.scheduled_at || '').startsWith(today))

  // 체크박스
  const toggleAll = () => {
    if (checked.size === filtered.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(filtered.map(l => l.id)))
    }
  }
  const toggleOne = (id: string) => {
    const next = new Set(checked)
    next.has(id) ? next.delete(id) : next.add(id)
    setChecked(next)
  }

  // 개별 삭제
  const deleteOne = async (id: string) => {
    if (!confirm('이 예약을 취소하시겠습니까?')) return
    await fetch('/api/logs', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setLogs(prev => prev.filter(l => l.id !== id))
    setChecked(prev => { const n = new Set(prev); n.delete(id); return n })
    setMsg('✅ 삭제 완료')
  }

  // 일괄 삭제
  const deleteChecked = async () => {
    if (checked.size === 0) return
    if (!confirm(`선택한 ${checked.size}개 예약을 취소하시겠습니까?`)) return
    setDeleting(true)
    setMsg('')
    const ids = Array.from(checked)
    let done = 0
    for (const id of ids) {
      await fetch('/api/logs', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
      done++
      setMsg(`🗑 삭제 중... ${done}/${ids.length}`)
    }
    setLogs(prev => prev.filter(l => !checked.has(l.id)))
    setChecked(new Set())
    setDeleting(false)
    setMsg(`✅ ${ids.length}개 예약 취소 완료`)
  }

  // 오늘 초과분 자동 정리 (3개만 남기기)
  const cleanupToday = async () => {
    const keep = 2
    const toDelete = todayLogs.slice(keep)
    if (toDelete.length === 0) { setMsg('오늘 예약이 이미 적어요!'); return }
    if (!confirm(`오늘 예약 ${todayLogs.length}개 중 ${toDelete.length}개를 삭제하고 ${keep}개만 남길까요?`)) return
    setDeleting(true)
    for (const l of toDelete) {
      await fetch('/api/logs', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: l.id }) })
    }
    await fetchLogs()
    setDeleting(false)
    setMsg(`✅ 오늘 예약 ${keep}개만 남기고 ${toDelete.length}개 삭제 완료`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 84px)', gap: '12px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>📅 예약 관리</div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
            예약됨 총 {logs.length}개 · 오늘 {todayLogs.length}개
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {todayLogs.length > 2 && (
            <button onClick={cleanupToday} disabled={deleting}
              style={{ padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px',
                background: 'rgba(255,184,0,0.1)', border: '1px solid #ffb800', color: '#ffb800', fontWeight: '700' }}>
              ⚡ 오늘 {todayLogs.length}개 → 2개로 정리
            </button>
          )}
          <button onClick={fetchLogs} style={{ padding: '7px 12px', borderRadius: '7px', cursor: 'pointer',
            background: '#1c1c1c', border: '1px solid #2a2a2a', color: '#666', fontSize: '12px' }}>↺ 새로고침</button>
        </div>
      </div>

      {/* 메시지 */}
      {msg && (
        <div style={{ padding: '8px 14px', borderRadius: '7px', fontSize: '12px',
          background: msg.startsWith('✅') ? 'rgba(0,196,113,0.1)' : 'rgba(255,184,0,0.1)',
          border: `1px solid ${msg.startsWith('✅') ? '#00c471' : '#ffb800'}`,
          color: msg.startsWith('✅') ? '#00c471' : '#ffb800' }}>
          {msg}
        </div>
      )}

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', background: '#1c1c1c',
            border: '1px solid #2a2a2a', color: '#ccc', fontSize: '12px', outline: 'none' }} />
        {filterDate && (
          <button onClick={() => setFilterDate('')}
            style={{ padding: '6px 10px', borderRadius: '6px', background: 'transparent',
              border: '1px solid #333', color: '#555', fontSize: '11px', cursor: 'pointer' }}>✕ 날짜 초기화</button>
        )}
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', background: '#1c1c1c',
            border: '1px solid #2a2a2a', color: '#ccc', fontSize: '12px', outline: 'none' }}>
          <option value="all">전체 사이트</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {checked.size > 0 && (
          <button onClick={deleteChecked} disabled={deleting}
            style={{ padding: '7px 16px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '700',
              background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.4)', color: '#ff4444' }}>
            🗑 선택 {checked.size}개 삭제
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div style={{ flex: 1, background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: '10px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* 헤더 */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 120px 90px 90px 60px',
          padding: '9px 14px', background: '#161616', borderBottom: '1px solid #2a2a2a',
          fontSize: '10px', fontWeight: '700', color: '#444', letterSpacing: '0.5px', textTransform: 'uppercase', flexShrink: 0 }}>
          <div>
            <input type="checkbox" checked={checked.size > 0 && checked.size === filtered.length}
              onChange={toggleAll} style={{ cursor: 'pointer', accentColor: '#1E6AFF' }} />
          </div>
          <span>제목 / 키워드</span>
          <span>사이트</span>
          <span>예약 날짜</span>
          <span>예약 시각</span>
          <span>언어</span>
          <span></span>
        </div>

        {/* 행 */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#444' }}>로드 중...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
              <div style={{ fontSize: '14px', color: '#555' }}>예약된 글이 없습니다</div>
            </div>
          ) : filtered.map(log => {
            const isToday = (log.scheduled_at || '').startsWith(today)
            const scheduledDate = log.scheduled_at ? new Date(log.scheduled_at) : null
            return (
              <div key={log.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 120px 120px 90px 90px 60px',
                padding: '10px 14px', borderBottom: '1px solid #1a1a1a',
                background: checked.has(log.id) ? 'rgba(30,106,255,0.06)' : isToday ? 'rgba(255,184,0,0.03)' : 'transparent',
                borderLeft: isToday ? '2px solid rgba(255,184,0,0.4)' : '2px solid transparent',
                alignItems: 'center',
              }}>
                <input type="checkbox" checked={checked.has(log.id)} onChange={() => toggleOne(log.id)}
                  style={{ cursor: 'pointer', accentColor: '#1E6AFF' }} />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                    {log.title}
                  </div>
                  <div style={{ fontSize: '10px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    🔑 {log.keyword_text}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.sites?.name || '—'}
                </div>
                <div style={{ fontSize: '11px', color: isToday ? '#ffb800' : '#888' }}>
                  {scheduledDate ? scheduledDate.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '—'}
                  {isToday && <span style={{ fontSize: '9px', marginLeft: '4px', color: '#ffb800' }}>오늘</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#888', fontVariantNumeric: 'tabular-nums' }}>
                  {scheduledDate ? scheduledDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  {LANG_FLAGS[log.language] || '🌐'} {log.language?.toUpperCase()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button onClick={() => deleteOne(log.id)}
                    style={{ background: 'transparent', border: 'none', color: '#333', cursor: 'pointer',
                      fontSize: '13px', padding: '3px 6px', borderRadius: '3px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ff4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#333')}>
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 푸터 */}
        <div style={{ borderTop: '1px solid #222', padding: '7px 14px', fontSize: '10px',
          color: '#444', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span>총 {filtered.length}개 예약 · {checked.size > 0 && `${checked.size}개 선택됨`}</span>
          <span style={{ color: '#ffb800' }}>🟡 오늘 예약: {todayLogs.length}개</span>
        </div>
      </div>
    </div>
  )
}
