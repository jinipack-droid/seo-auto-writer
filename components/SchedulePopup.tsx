'use client'

import { useState, useCallback } from 'react'

// ─── types ───────────────────────────────────────────────────────────────────
export interface ScheduleConfig {
  type: 'immediate' | 'scheduled'
  dates: string[]           // ISO date strings: '2025-03-10'
  times: string[]           // per-date times: '09:00'
  postsPerDay: number
  totalPosts: number
}

interface SchedulePopupProps {
  open: boolean
  onClose: () => void
  onConfirm: (config: ScheduleConfig) => void
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function startDay(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)   // 'YYYY-MM-DD'
}
function addDays(base: Date, n: number) {
  const d = new Date(base); d.setDate(d.getDate() + n); return d
}
const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const DAYS_KO   = ['일','월','화','수','목','금','토']

// ─── main component ──────────────────────────────────────────────────────────
export default function SchedulePopup({ open, onClose, onConfirm }: SchedulePopupProps) {
  const today = new Date(); today.setHours(0,0,0,0)

  const [viewYear,    setViewYear]    = useState(today.getFullYear())
  const [viewMonth,   setViewMonth]   = useState(today.getMonth())
  const [rangeStart,  setRangeStart]  = useState<Date | null>(null)
  const [rangeEnd,    setRangeEnd]    = useState<Date | null>(null)
  const [hovered,     setHovered]     = useState<Date | null>(null)
  const [postsPerDay, setPostsPerDay] = useState(1)
  const [startTime,   setStartTime]   = useState('09:00')
  const [randomDelay, setRandomDelay] = useState(true)

  // 최대 1년 후
  const maxDate = new Date(today); maxDate.setFullYear(maxDate.getFullYear() + 1)

  // 날짜 범위 → 실제 발행 날짜 배열 계산 (시작~종료 사이 매일 포함)
  const computeDates = useCallback((): string[] => {
    if (!rangeStart) return []
    const end = rangeEnd || rangeStart
    const dates: string[] = []
    let cur = new Date(rangeStart)
    while (cur <= end) {
      dates.push(fmtDate(cur))
      cur = addDays(cur, 1)
    }
    return dates
  }, [rangeStart, rangeEnd])

  const selectedDates = computeDates()
  const totalPosts    = selectedDates.length * postsPerDay

  // 달력 이전/다음 달
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // 날짜 클릭: 첫 클릭=시작, 두 번째=종료, 세 번째=리셋
  const handleDayClick = (d: Date) => {
    if (d < today || d > maxDate) return
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d); setRangeEnd(null)
    } else {
      if (d >= rangeStart) setRangeEnd(d)
      else { setRangeStart(d); setRangeEnd(rangeStart) }
    }
  }

  const inRange = (d: Date) => {
    const end = rangeEnd || hovered
    if (!rangeStart || !end) return false
    const lo = rangeStart < end ? rangeStart : end
    const hi = rangeStart < end ? end : rangeStart
    return d >= lo && d <= hi
  }
  const isStart = (d: Date) => rangeStart && fmtDate(d) === fmtDate(rangeStart)
  const isEnd   = (d: Date) => rangeEnd   && fmtDate(d) === fmtDate(rangeEnd)

  // 확인 버튼
  const handleConfirm = () => {
    if (!rangeStart) return
    const times = selectedDates.map(() => startTime)
    onConfirm({
      type: 'scheduled',
      dates: selectedDates,
      times,
      postsPerDay,
      totalPosts,
    })
    onClose()
  }

  if (!open) return null

  // 달력 셀 렌더
  const numDays  = daysInMonth(viewYear, viewMonth)
  const firstDay = startDay(viewYear, viewMonth)
  const cells    = Array.from({ length: firstDay + numDays }, (_, i) => {
    if (i < firstDay) return null
    return new Date(viewYear, viewMonth, i - firstDay + 1)
  })

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center',
      backdropFilter:'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background:'#181818', border:'1px solid #333', borderRadius:'12px',
        padding:'24px', width:'760px', maxWidth:'95vw',
        boxShadow:'0 24px 60px rgba(0,0,0,0.7)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:'#fff' }}>📅 게시글 발행 예약</div>
            <div style={{ fontSize:'11px', color:'#555', marginTop:'2px' }}>날짜 범위를 선택하세요 (최대 1년)</div>
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:'1px solid #333', borderRadius:'6px',
            color:'#777', padding:'6px 12px', cursor:'pointer', fontSize:'12px',
          }}>✕ 닫기</button>
        </div>

        <div style={{ display:'flex', gap:'20px' }}>

          {/* ── 달력 ── */}
          <div style={{ flex:'0 0 300px' }}>
            {/* 달력 헤더 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <button onClick={prevMonth} style={navBtnStyle}>‹ 이전</button>
              <span style={{ fontSize:'14px', fontWeight:'700', color:'#fff' }}>
                {viewYear}년 {MONTHS_KO[viewMonth]}
              </span>
              <button onClick={nextMonth} style={navBtnStyle}>다음 ›</button>
            </div>

            {/* 요일 헤더 */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'4px' }}>
              {DAYS_KO.map((d, i) => (
                <div key={d} style={{
                  textAlign:'center', fontSize:'10px', fontWeight:'700', padding:'4px 0',
                  color: i===0?'#ff6b6b':i===6?'#5b9aff':'#555',
                }}>{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
              {cells.map((d, i) => {
                if (!d) return <div key={i} />
                const isPast    = d < today
                const isFuture  = d > maxDate
                const disabled  = isPast || isFuture
                const isToday   = fmtDate(d) === fmtDate(today)
                const start     = isStart(d)
                const end       = isEnd(d)
                const inR       = inRange(d)
                const dow       = d.getDay()

                return (
                  <div key={i}
                    onClick={() => !disabled && handleDayClick(d)}
                    onMouseEnter={() => !disabled && rangeStart && !rangeEnd && setHovered(d)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      textAlign:'center', fontSize:'11px', padding:'5px 2px',
                      borderRadius: start || end ? '6px' : inR ? '0' : '4px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      background: start || end ? '#1E6AFF' :
                                  inR ? 'rgba(30,106,255,0.18)' : 'transparent',
                      color: disabled ? '#333' : start || end ? '#fff' :
                             isToday ? '#1E6AFF' : dow===0 ? '#ff6b6b' : dow===6 ? '#5b9aff' : '#ccc',
                      fontWeight: isToday ? '700' : 'normal',
                      border: isToday && !start && !end ? '1px solid #1E6AFF' : '1px solid transparent',
                      transition:'all 0.1s',
                    }}
                  >{d.getDate()}</div>
                )
              })}
            </div>

            {/* 범위 표시 */}
            <div style={{ marginTop:'10px', fontSize:'11px', color:'#555', textAlign:'center' }}>
              {rangeStart
                ? `${fmtDate(rangeStart)}${rangeEnd ? ` ~ ${fmtDate(rangeEnd)}` : ' (종료 날짜 선택 중...)'}`
                : '시작 날짜를 클릭하세요'}
            </div>
          </div>

          {/* ── 설정 패널 ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'14px' }}>

            {/* 사이트당 하루 발행 글수 */}
            <div>
              <div style={{ ...labelStyle, marginBottom:'6px' }}>
                📝 사이트당 하루 발행 글수 &nbsp;
                <span style={{ color:'#1E6AFF', fontWeight:'800' }}>{postsPerDay}개</span>
              </div>
              <input type="range" min={1} max={20} value={postsPerDay}
                onChange={e => setPostsPerDay(+e.target.value)}
                style={{ width:'100%', accentColor:'#1E6AFF' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#444', marginTop:'2px' }}>
                <span>1개 / 일</span><span style={{ color:'#1E6AFF' }}>권장: 1~2개</span><span>20개 / 일</span>
              </div>
            </div>

            {/* 발행 시각 */}
            <div>
              <div style={labelStyle}>⏰ 발행 시각</div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  style={{ ...inputStyle, flex:1 }} />
                <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#888', cursor:'pointer' }}>
                  <input type="checkbox" checked={randomDelay} onChange={e => setRandomDelay(e.target.checked)}
                    style={{ accentColor:'#1E6AFF' }} />
                  ±30분 랜덤 딜레이
                </label>
              </div>
            </div>

            {/* 예약 요약 */}
            <div style={{
              background:'rgba(30,106,255,0.06)', border:'1px solid #1E6AFF',
              borderRadius:'8px', padding:'12px',
            }}>
              <div style={{ fontSize:'11px', color:'#555', marginBottom:'8px' }}>📊 예약 요약</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
                {[
                  { l:'선택 일수', v: rangeEnd
                      ? Math.round((rangeEnd.getTime()-rangeStart!.getTime())/86400000)+1
                      : rangeStart ? 1 : 0, u:'일' },
                  { l:'발행 횟수', v: selectedDates.length, u:'회' },
                  { l:'총 게시글', v: totalPosts, u:'건' },
                ].map(s => (
                  <div key={s.l} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'20px', fontWeight:'800', color:'#1E6AFF', lineHeight:'1.1' }}>
                      {s.v}<span style={{ fontSize:'12px' }}>{s.u}</span>
                    </div>
                    <div style={{ fontSize:'10px', color:'#555', marginTop:'2px' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 확인 버튼 */}
            <button onClick={handleConfirm} disabled={!rangeStart || totalPosts === 0}
              style={{
                width:'100%', padding:'12px', borderRadius:'8px', fontSize:'13px',
                fontWeight:'700', cursor: rangeStart && totalPosts>0 ? 'pointer' : 'not-allowed',
                background: rangeStart && totalPosts>0 ? '#1E6AFF' : '#222',
                border:'none', color: rangeStart && totalPosts>0 ? '#fff' : '#444',
                transition:'all 0.2s',
              }}>
              {totalPosts > 0
                ? `✓ ${totalPosts}건 예약 확정`
                : '날짜를 선택하세요'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 인라인 스타일 상수 ────────────────────────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  background:'#222', border:'1px solid #333', borderRadius:'5px',
  color:'#888', padding:'4px 10px', cursor:'pointer', fontSize:'11px',
}
const labelStyle: React.CSSProperties = {
  fontSize:'10px', fontWeight:'700', color:'#555',
  textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px',
}
const inputStyle: React.CSSProperties = {
  background:'#222', border:'1px solid #333', borderRadius:'6px',
  color:'#ccc', padding:'6px 10px', fontSize:'12px', outline:'none',
}
