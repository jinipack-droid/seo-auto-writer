'use client'
import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/lib/language-context'

interface Log {
  id: string
  site_id: string
  sites?: { name: string; url: string } | null
  keyword_text: string
  title: string
  language: string
  category: string
  word_count: number | null
  image_count: number | null
  prompt_type: string | null
  scheduled_at: string | null
  published_at: string | null
  status: 'pending' | 'published' | 'failed' | 'scheduled'
  error_message: string | null
  claude_tokens: number | null
  wp_post_url: string | null
  created_at: string
}

interface Summary {
  total: number
  published: number
  pending: number
  scheduled: number
  failed: number
  tokens: number
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  published: { label: '발행됨',  color: '#00c471', bg: 'rgba(0,196,113,0.1)' },
  pending:   { label: '처리중',  color: '#1E6AFF', bg: 'rgba(30,106,255,0.1)' },
  scheduled: { label: '예약됨',  color: '#ffb800', bg: 'rgba(255,184,0,0.1)' },
  failed:    { label: '실패',    color: '#ff4444', bg: 'rgba(255,68,68,0.1)' },
}
const LANG_FLAGS: Record<string, string> = { en: '🇺🇸', ko: '🇰🇷', ja: '🇯🇵' }

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function LogsPage() {
  const { lang } = useLang()
  const [logs,       setLogs]       = useState<Log[]>([])
  const [summary,    setSummary]    = useState<Summary | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [filterLang, setFilterLang] = useState<string>(lang)
  const [filterSts,  setFilterSts]  = useState('all')

  // 전역 언어 변경 시 자동 동기화
  useEffect(() => { setFilterLang(lang) }, [lang])
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<Log | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [publishMsg, setPublishMsg] = useState<{ id: string; type: 'success'|'error'; text: string } | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ lang: filterLang, status: filterSts, limit: '200' })
      const res  = await fetch(`/api/logs?${params}`)
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs || [])
        setSummary(data.summary)
      }
    } finally {
      setLoading(false)
    }
  }, [filterLang, filterSts])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const deleteLog = async (id: string) => {
    if (!confirm('이 로그를 삭제하시겠습니까?')) return
    setDeleting(id)
    await fetch('/api/logs', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setLogs(prev => prev.filter(l => l.id !== id))
    if (selected?.id === id) setSelected(null)
    setDeleting(null)
  }

  const publishNow = async (id: string) => {
    if (!confirm('지금 바로 WordPress에 발행하시겠습니까?')) return
    setPublishing(id)
    setPublishMsg(null)
    try {
      const res  = await fetch(`/api/publish/${id}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        setPublishMsg({ id, type: 'success', text: `✅ 발행 완료! ${data.postUrl || ''}` })
        // 로그 상태 업데이트
        setLogs(prev => prev.map(l =>
          l.id === id ? { ...l, status: 'published', wp_post_url: data.postUrl } : l
        ))
        if (selected?.id === id) {
          setSelected(prev => prev ? { ...prev, status: 'published', wp_post_url: data.postUrl } : null)
        }
        fetchLogs()
      } else {
        setPublishMsg({ id, type: 'error', text: `❌ ${data.error || '발행 실패'}` })
      }
    } catch {
      setPublishMsg({ id, type: 'error', text: '❌ 네트워크 오류가 발생했습니다.' })
    } finally {
      setPublishing(null)
    }
  }

  const filtered = logs.filter(l =>
    !search || l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.keyword_text.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 84px)', gap:'10px' }}>

      {/* ── 통계 바 ── */}
      <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
        {summary ? [
          { l:'총 발행', n: summary.total,     c:'#fff'    },
          { l:'발행됨',  n: summary.published,  c:'#00c471' },
          { l:'처리중',  n: summary.pending,    c:'#1E6AFF' },
          { l:'예약됨',  n: summary.scheduled,  c:'#ffb800' },
          { l:'실패',    n: summary.failed,     c:'#ff4444' },
          { l:'총 토큰', n: summary.tokens >= 1000 ? `${(summary.tokens/1000).toFixed(1)}k` : summary.tokens, c:'#888' },
        ].map(s => (
          <div key={s.l} style={{ flex:1, background:'#1c1c1c', border:'1px solid #2a2a2a',
            borderRadius:'8px', padding:'10px 14px' }}>
            <div style={{ fontSize:'20px', fontWeight:'800', color:s.c, lineHeight:'1' }}>{s.n}</div>
            <div style={{ fontSize:'10px', color:'#555', marginTop:'3px' }}>{s.l}</div>
          </div>
        )) : Array(6).fill(0).map((_,i) => (
          <div key={i} style={{ flex:1, background:'#1c1c1c', border:'1px solid #2a2a2a',
            borderRadius:'8px', padding:'10px 14px', height:'52px' }} />
        ))}
      </div>

      {/* ── 필터 & 검색 바 ── */}
      <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0 }}>
        {/* 검색 */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 제목 또는 키워드 검색..."
          style={{ flex:1, background:'#1c1c1c', border:'1px solid #2a2a2a', borderRadius:'7px',
            color:'#ccc', padding:'7px 12px', fontSize:'12px', outline:'none' }} />
        {/* 언어 필터 */}
        <div style={{ display:'flex', gap:'4px' }}>
          {(['all','en','ko','ja'] as const).map(v => (
            <button key={v} onClick={() => setFilterLang(v)} style={{
              padding:'6px 12px', borderRadius:'5px', fontSize:'11px', cursor:'pointer',
              fontWeight: filterLang===v ? '700' : '400',
              background: filterLang===v ? 'rgba(30,106,255,0.15)' : '#1c1c1c',
              border: `1px solid ${filterLang===v?'#1E6AFF':'#2a2a2a'}`,
              color: filterLang===v ? '#1E6AFF' : '#666',
            }}>
              {v === 'all' ? '전체' : `${LANG_FLAGS[v]} ${v.toUpperCase()}`}
            </button>
          ))}
        </div>
        {/* 상태 필터 */}
        <div style={{ display:'flex', gap:'4px' }}>
          {(['all','published','pending','scheduled','failed'] as const).map(v => {
            const info = STATUS_LABELS[v] || { label:'전체', color:'#888', bg:'transparent' }
            const active = filterSts === v
            return (
              <button key={v} onClick={() => setFilterSts(v)} style={{
                padding:'6px 12px', borderRadius:'5px', fontSize:'11px', cursor:'pointer',
                fontWeight: active ? '700' : '400',
                background: active ? info.bg : '#1c1c1c',
                border: `1px solid ${active ? info.color : '#2a2a2a'}`,
                color: active ? info.color : '#666',
              }}>
                {v === 'all' ? '전체 상태' : info.label}
              </button>
            )
          })}
        </div>
        {/* 새로고침 */}
        <button onClick={fetchLogs} style={{
          padding:'6px 14px', borderRadius:'5px', background:'#1c1c1c',
          border:'1px solid #2a2a2a', color:'#666', fontSize:'11px', cursor:'pointer',
        }}>↺</button>
      </div>

      {/* ── 메인 컨텐츠 (테이블 + 상세) ── */}
      <div style={{ flex:1, display:'flex', gap:'10px', overflow:'hidden' }}>

        {/* 로그 테이블 */}
        <div style={{ flex:1, background:'#1c1c1c', border:'1px solid #2a2a2a',
          borderRadius:'8px', display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* 테이블 헤더 */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 70px 80px 90px 70px 110px 50px',
            padding:'8px 14px', background:'#161616', borderBottom:'1px solid #2a2a2a',
            fontSize:'10px', fontWeight:'700', color:'#444', letterSpacing:'0.5px',
            textTransform:'uppercase', flexShrink:0 }}>
            <span>제목 / 키워드</span>
            <span>언어</span>
            <span>프롬프트</span>
            <span>상태</span>
            <span>토큰</span>
            <span>생성일</span>
            <span></span>
          </div>

          {/* 로그 행들 */}
          <div style={{ overflowY:'auto', flex:1 }}>
            {loading ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#444', fontSize:'13px' }}>
                <div className="spinner" style={{ display:'inline-block', marginRight:'8px' }} />
                로그 불러오는 중...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:'60px', textAlign:'center' }}>
                <div style={{ fontSize:'32px', marginBottom:'12px' }}>📭</div>
                <div style={{ fontSize:'14px', color:'#555' }}>
                  {search ? `"${search}"에 해당하는 로그가 없습니다` : '발행 로그가 없습니다'}
                </div>
                <div style={{ fontSize:'12px', color:'#444', marginTop:'6px' }}>
                  AI 글 생성을 시작하면 여기에 기록됩니다
                </div>
              </div>
            ) : filtered.map(log => {
              const info = STATUS_LABELS[log.status] || STATUS_LABELS.pending
              const isSelected = selected?.id === log.id
              return (
                <div key={log.id}
                  onClick={() => setSelected(isSelected ? null : log)}
                  style={{
                    display:'grid', gridTemplateColumns:'2fr 70px 80px 90px 70px 110px 50px',
                    padding:'10px 14px', borderBottom:'1px solid #1a1a1a',
                    cursor:'pointer', transition:'background 0.12s',
                    background: isSelected ? 'rgba(30,106,255,0.07)' : 'transparent',
                    borderLeft: isSelected ? '2px solid #1E6AFF' : '2px solid transparent',
                  }}
                  onMouseEnter={e => !isSelected && (e.currentTarget.style.background='#222')}
                  onMouseLeave={e => !isSelected && (e.currentTarget.style.background='transparent')}
                >
                  {/* 제목 */}
                  <div style={{ overflow:'hidden' }}>
                    <div style={{ fontSize:'12px', color:'#ddd', overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'2px' }}>
                      {log.title}
                    </div>
                    <div style={{ fontSize:'10px', color:'#555', overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      🔑 {log.keyword_text}
                    </div>
                  </div>
                  {/* 언어 */}
                  <div style={{ display:'flex', alignItems:'center', fontSize:'12px', color:'#888' }}>
                    {LANG_FLAGS[log.language] || '🌐'} {log.language?.toUpperCase()}
                  </div>
                  {/* 프롬프트 */}
                  <div style={{ display:'flex', alignItems:'center' }}>
                    <span style={{ fontSize:'10px', fontWeight:'600', color:'#ffb800',
                      background:'rgba(255,184,0,0.1)', padding:'2px 6px', borderRadius:'4px' }}>
                      {log.prompt_type || '—'}
                    </span>
                  </div>
                  {/* 상태 */}
                  <div style={{ display:'flex', alignItems:'center' }}>
                    <span style={{ fontSize:'10px', fontWeight:'600', color: info.color,
                      background: info.bg, padding:'3px 8px', borderRadius:'4px' }}>
                      {info.label}
                    </span>
                  </div>
                  {/* 토큰 */}
                  <div style={{ display:'flex', alignItems:'center', fontSize:'11px', color:'#555' }}>
                    {log.claude_tokens ? `${(log.claude_tokens/1000).toFixed(1)}k` : '—'}
                  </div>
                  {/* 생성일 */}
                  <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', fontSize:'10px' }}>
                    <span style={{ color:'#aaa', fontVariantNumeric:'tabular-nums' }}>
                      {new Date(log.created_at).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' })}
                      {' '}
                      {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', hour12:false })}
                    </span>
                    <span style={{ color:'#444', fontSize:'9px', marginTop:'1px' }}>{timeAgo(log.created_at)}</span>
                  </div>
                  {/* 삭제 */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <button
                      disabled={deleting === log.id}
                      onClick={e => { e.stopPropagation(); deleteLog(log.id) }}
                      style={{ background:'transparent', border:'none', color:'#333',
                        cursor:'pointer', fontSize:'13px', padding:'3px 6px',
                        borderRadius:'3px', transition:'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color='#ff4444')}
                      onMouseLeave={e => (e.currentTarget.style.color='#333')}
                    >✕</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 테이블 푸터 */}
          <div style={{ borderTop:'1px solid #222', padding:'7px 14px', fontSize:'10px',
            color:'#444', display:'flex', justifyContent:'space-between', flexShrink:0 }}>
            <span>총 {filtered.length}건</span>
            {selected && <span style={{ color:'#1E6AFF' }}>↗ 클릭 시 상세 보기</span>}
          </div>
        </div>

        {/* ── 상세 패널 ── */}
        {selected && (
          <div style={{ width:'360px', flexShrink:0, background:'#1c1c1c',
            border:'1px solid #2a2a2a', borderRadius:'8px', display:'flex',
            flexDirection:'column', overflow:'hidden' }}>

            {/* 상세 헤더 */}
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #222',
              display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#fff', marginBottom:'4px',
                  lineHeight:'1.3' }}>{selected.title}</div>
                <div style={{ fontSize:'10px', color:'#555' }}>
                  {LANG_FLAGS[selected.language]} {selected.language?.toUpperCase()} &nbsp;·&nbsp;
                  {selected.category}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{
                background:'transparent', border:'none', color:'#444',
                cursor:'pointer', fontSize:'16px', padding:'0 4px', flexShrink:0,
              }}>✕</button>
            </div>

            {/* 상세 내용 */}
            <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>

                {/* 상태 배지 */}
                {(() => {
                  const info = STATUS_LABELS[selected.status]
                  return (
                    <div style={{ display:'flex', justifyContent:'center', padding:'8px',
                      background: info.bg, borderRadius:'7px', border:`1px solid ${info.color}` }}>
                      <span style={{ fontSize:'14px', fontWeight:'700', color: info.color }}>
                        {info.label}
                      </span>
                    </div>
                  )
                })()}

                {/* 메타 정보 */}
                {[
                  ['🌐 발행 사이트', selected.sites?.name || '—'],
                  ['📁 카테고리',   selected.category || '—'],
                  ['🔑 키워드',     selected.keyword_text],
                  ['🖼 이미지 수',  selected.image_count != null ? `${selected.image_count}개` : '—'],
                  ['📏 글자 수',    selected.word_count  ? `${selected.word_count.toLocaleString()}자` : '—'],
                  ['🎲 프롬프트',   selected.prompt_type || '—'],
                  ['⚡ 토큰',       selected.claude_tokens ? `${selected.claude_tokens.toLocaleString()}개` : '—'],
                  ['📅 예약 시각',  selected.scheduled_at ? new Date(selected.scheduled_at).toLocaleString('ko-KR') : '즉시 발행'],
                  ['✅ 발행 시각',  selected.published_at ? new Date(selected.published_at).toLocaleString('ko-KR') : '—'],
                  ['🕐 생성일',     new Date(selected.created_at).toLocaleString('ko-KR')],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between',
                    padding:'6px 0', borderBottom:'1px solid #1a1a1a', fontSize:'11px' }}>
                    <span style={{ color:'#555', flexShrink:0 }}>{k}</span>
                    <span style={{ color:'#bbb', maxWidth:'190px', textAlign:'right',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
                  </div>
                ))}

                {/* 오류 메시지 */}
                {selected.error_message && (
                  <div style={{ padding:'8px 10px', background:'rgba(255,68,68,0.08)',
                    border:'1px solid rgba(255,68,68,0.2)', borderRadius:'6px' }}>
                    <div style={{ fontSize:'10px', color:'#ff4444', fontWeight:'700', marginBottom:'4px' }}>
                      오류 내용
                    </div>
                    <div style={{ fontSize:'11px', color:'#ff8888' }}>{selected.error_message}</div>
                  </div>
                )}

                {/* WordPress URL */}
                {selected.wp_post_url && (
                  <a href={selected.wp_post_url} target="_blank" rel="noopener noreferrer"
                    style={{ display:'block', padding:'8px 12px', background:'rgba(30,106,255,0.08)',
                      border:'1px solid #1E6AFF', borderRadius:'6px', color:'#1E6AFF',
                      fontSize:'11px', textDecoration:'none', textAlign:'center', fontWeight:'600' }}>
                    🌐 게시글 페이지 열기 ↗
                  </a>
                )}
              </div>
            </div>

            {/* 발행 메시지 */}
            {publishMsg?.id === selected.id && (
              <div style={{ margin:'0 16px 8px', padding:'8px 10px', borderRadius:'6px',
                background: publishMsg.type === 'success' ? 'rgba(0,196,113,0.1)' : 'rgba(255,68,68,0.1)',
                border: `1px solid ${publishMsg.type === 'success' ? '#00c471' : '#ff4444'}`,
                fontSize:'11px', color: publishMsg.type === 'success' ? '#00c471' : '#ff4444',
                lineHeight:'1.4' }}>
                {publishMsg.text}
              </div>
            )}

            {/* 상세 액션 버튼 */}
            <div style={{ padding:'12px 16px', borderTop:'1px solid #222', flexShrink:0,
              display:'flex', gap:'6px', flexWrap:'wrap' }}>
              <button onClick={() => deleteLog(selected.id)}
                style={{ flex:1, minWidth:'60px', padding:'8px', borderRadius:'6px', cursor:'pointer',
                  background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.3)',
                  color:'#ff4444', fontSize:'11px', fontWeight:'600' }}>
                🗑 삭제
              </button>
              {/* 지금 발행 버튼 */}
              {(selected.status === 'scheduled' || selected.status === 'pending') && (
                <button
                  onClick={() => publishNow(selected.id)}
                  disabled={publishing === selected.id}
                  style={{ flex:2, minWidth:'100px', padding:'8px', borderRadius:'6px', cursor:'pointer',
                    background: publishing === selected.id ? '#1a1a1a' : 'rgba(0,196,113,0.1)',
                    border:`1px solid ${publishing === selected.id ? '#333' : '#00c471'}`,
                    color: publishing === selected.id ? '#555' : '#00c471',
                    fontSize:'11px', fontWeight:'700' }}>
                  {publishing === selected.id ? '⏳ 발행 중...' : '🚀 지금 발행'}
                </button>
              )}
              {selected.wp_post_url && (
                <a href={selected.wp_post_url} target="_blank" rel="noopener noreferrer"
                  style={{ flex:2, minWidth:'100px', padding:'8px', borderRadius:'6px', cursor:'pointer',
                    background:'rgba(30,106,255,0.1)', border:'1px solid #1E6AFF',
                    color:'#1E6AFF', fontSize:'11px', fontWeight:'700',
                    textDecoration:'none', textAlign:'center', display:'flex',
                    alignItems:'center', justifyContent:'center', gap:'4px' }}>
                  🌐 게시글 보기
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
