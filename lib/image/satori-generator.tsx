/**
 * lib/image/satori-generator.tsx
 * next/og ImageResponse 기반 카드뉴스 이미지 생성 (Vercel 호환, Puppeteer 불필요)
 * 20가지 Flexbox 전용 레이아웃, 500×500px
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'
import { ImageResponse } from 'next/og'

// ── 카테고리별 색상 테마 ──────────────────────────────────────────────────────
const THEMES: Record<string, { c1: string; c2: string; c3: string; bg: string; lt: string }> = {
  'skin-care':         { c1:'#1976D2', c2:'#0D47A1', c3:'#4FC3F7', bg:'#0D1B2A', lt:'#E3F2FD' },
  'medical-procedure': { c1:'#7B1FA2', c2:'#4A148C', c3:'#CE93D8', bg:'#1A0A2E', lt:'#F3E5F5' },
  'dental':            { c1:'#1565C0', c2:'#0D47A1', c3:'#64B5F6', bg:'#0A1628', lt:'#E8F5E9' },
  'anti-aging':        { c1:'#E65100', c2:'#BF360C', c3:'#FFB347', bg:'#1A0A00', lt:'#FFF3E0' },
  'supplements':       { c1:'#2E7D32', c2:'#1B5E20', c3:'#69DB7C', bg:'#0D2818', lt:'#E8F5E9' },
  'beauty':            { c1:'#C2185B', c2:'#880E4F', c3:'#F48FB1', bg:'#2D0A1E', lt:'#FCE4EC' },
  'health':            { c1:'#01579B', c2:'#0D47A1', c3:'#4FC3F7', bg:'#0A1628', lt:'#E1F5FE' },
  'lifestyle':         { c1:'#388E3C', c2:'#2E7D32', c3:'#A5D6A7', bg:'#1B2A1B', lt:'#E8F5E9' },
  'functional-food':   { c1:'#E65100', c2:'#BF360C', c3:'#FFCC80', bg:'#2A1500', lt:'#FFF8E1' },
  'diet-clinic':       { c1:'#4527A0', c2:'#311B92', c3:'#B39DDB', bg:'#1A0A2E', lt:'#EDE7F6' },
  'cancer-prevention': { c1:'#00695C', c2:'#004D40', c3:'#80CBC4', bg:'#0A2018', lt:'#E0F2F1' },
  'mental-health':     { c1:'#283593', c2:'#1A237E', c3:'#9FA8DA', bg:'#0A1628', lt:'#E8EAF6' },
  'medical-tourism':   { c1:'#00838F', c2:'#006064', c3:'#80DEEA', bg:'#0D1B2A', lt:'#E0F7FA' },
}
const DT = { c1:'#01579B', c2:'#0D47A1', c3:'#4FC3F7', bg:'#0A1628', lt:'#E1F5FE' }

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface CardData {
  title: string
  captions: string[]
  category: string
  language?: string
  layout?: number
  variant?: number
  siteName?: string
}

type T = typeof DT
type R = React.ReactNode

// ── 폰트 로드 (캐싱) ─────────────────────────────────────────────────────────
type FontEntry = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }
let _fonts: FontEntry[] | null = null

function loadFonts(): FontEntry[] {
  if (_fonts) return _fonts
  const nm = join(process.cwd(), 'node_modules')
  const tryF = (p: string): ArrayBuffer | null => {
    try { return readFileSync(p).buffer as ArrayBuffer } catch { return null }
  }

  const fonts: FontEntry[] = []
  const pairs: [string, 400 | 700][] = [
    ['@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff', 400],
    ['@fontsource/noto-sans-kr/files/noto-sans-kr-korean-700-normal.woff', 700],
    ['@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff', 400],
    ['@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff', 700],
    ['@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff', 400],
    ['@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff', 700],
  ]
  for (const [rel, weight] of pairs) {
    const data = tryF(join(nm, rel))
    if (data) fonts.push({ name: 'NS', data, weight, style: 'normal' })
  }
  _fonts = fonts
  return fonts
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
const W = 500
const FF = 'NS, sans-serif'
const tr = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s
const fs = (s: string) => s.length <= 8 ? 46 : s.length <= 14 ? 36 : s.length <= 20 ? 28 : 22
const ca = (d: CardData) => (d.captions.length > 0 ? d.captions : ['내용 1', '내용 2', '내용 3', '내용 4']).slice(0, 4)
const si = (d: CardData) => d.siteName || 'seo-writer'

// 수직 목록
function VList({ items, t, dark }: { items: string[]; t: T; dark: boolean }) {
  const sc = dark ? '#fff' : '#1a1a1a'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {items.slice(0,4).map((c,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', width:22, height:22, borderRadius:11, background:i%2===0?t.c1:t.c3, alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', fontFamily:FF, flexShrink:0 }}>{i+1}</div>
          <div style={{ display:'flex', fontSize:13, color:sc, lineHeight:1.4, fontFamily:FF }}>{tr(c, 24)}</div>
        </div>
      ))}
    </div>
  )
}

// 2×2 그리드 (4개 아이템)
function Grid2({ items, t, dark }: { items: string[]; t: T; dark: boolean }) {
  const sc = dark ? '#fff' : '#1a1a1a'
  const gc = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'
  const bc = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'
  const its = (items.slice(0,4).length < 4 ? [...items, '추가 항목', '추가 항목', '추가 항목'] : items).slice(0,4)
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
      {its.map((c,i) => (
        <div key={i} style={{ display:'flex', flexDirection:'column', width:'calc(50% - 4px)', minHeight:60, background:gc, border:`1px solid ${bc}`, borderRadius:8, padding:'10px 10px', boxSizing:'border-box' }}>
          <div style={{ display:'flex', fontSize:10, color:t.c3, fontWeight:700, fontFamily:FF, marginBottom:4 }}>{`0${i+1}`}</div>
          <div style={{ display:'flex', fontSize:12, color:sc, lineHeight:1.35, fontFamily:FF }}>{tr(c, 20)}</div>
        </div>
      ))}
    </div>
  )
}

// 배지 목록
function Badges({ items, t, dark }: { items: string[]; t: T; dark: boolean }) {
  const sc = dark ? '#fff' : '#1a1a1a'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
      {items.slice(0,4).map((c,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, border:`1.5px solid ${i%2===0?t.c1:t.c3}`, borderRadius:28, padding:'7px 14px' }}>
          <span style={{ display:'flex', background:i%2===0?t.c1:t.c3, color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, fontFamily:FF, flexShrink:0 }}>{`0${i+1}`}</span>
          <span style={{ display:'flex', fontSize:12, color:sc, fontFamily:FF }}>{tr(c, 22)}</span>
        </div>
      ))}
    </div>
  )
}

// 계단형
function Steps({ items, t, dark }: { items: string[]; t: T; dark: boolean }) {
  const sc = dark ? '#fff' : '#1a1a1a'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {items.slice(0,4).map((c,i) => (
        <div key={i} style={{ display:'flex', marginLeft:i*14, borderLeft:`4px solid ${i%2===0?t.c1:t.c3}`, borderRadius:'0 8px 8px 0', padding:'7px 12px', background:dark?'rgba(255,255,255,.05)':t.c1+'11' }}>
          <div style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', fontSize:9, color:t.c1, fontWeight:700, fontFamily:FF }}>STEP {`0${i+1}`}</div>
            <div style={{ display:'flex', fontSize:12, color:sc, fontFamily:FF }}>{tr(c, 22)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// 가로 스트립
function HStrip({ items, t, dark }: { items: string[]; t: T; dark: boolean }) {
  const sc = dark ? '#fff' : '#1a1a1a'
  const nc = dark ? t.c3 : t.c1
  const sep = dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)'
  const its = items.slice(0,4).length < 4 ? [...items, '추가'].slice(0,4) : items.slice(0,4)
  return (
    <div style={{ display:'flex', width:'100%', background:dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.04)', borderRadius:8 }}>
      {its.map((c,i) => (
        <div key={i} style={{ display:'flex', flex:1, flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'10px 6px', borderRight:i<3?`1px solid ${sep}`:'none' }}>
          <div style={{ display:'flex', fontSize:10, color:nc, fontWeight:700, fontFamily:FF, marginBottom:3 }}>{`0${i+1}`}</div>
          <div style={{ display:'flex', fontSize:11, color:sc, fontFamily:FF, textAlign:'center' }}>{tr(c, 10)}</div>
        </div>
      ))}
    </div>
  )
}

// 태그 배지
function TagBadge({ text, t }: { text: string; t: T }) {
  return (
    <div style={{ display:'flex', background:t.c1, borderRadius:6, padding:'4px 12px', marginBottom:10 }}>
      <span style={{ display:'flex', fontSize:11, color:'#fff', fontWeight:700, fontFamily:FF }}>{tr(text.replace(/-/g,' ').toUpperCase(), 20)}</span>
    </div>
  )
}

// ── 20가지 레이아웃 ─────────────────────────────────────────────────────────
// 내용 셀렉터: variant 기반 content 타입
type CT = 'vl' | 'g2' | 'bd' | 'st' | 'hs'
const CTMAP: CT[] = ['vl', 'g2', 'bd', 'st', 'hs']

function Content({ ct, items, t, dark }: { ct: CT; items: string[]; t: T; dark: boolean }) {
  if (ct === 'g2') return <Grid2 items={items} t={t} dark={dark} />
  if (ct === 'bd') return <Badges items={items} t={t} dark={dark} />
  if (ct === 'st') return <Steps items={items} t={t} dark={dark} />
  if (ct === 'hs') return <HStrip items={items} t={t} dark={dark} />
  return <VList items={items} t={t} dark={dark} />
}

// Layout factory
function makeLayout(li: number, d: CardData, t: T, ct: CT): R {
  const items = ca(d)
  const title = tr(d.title, 20)
  const site = si(d)
  const fsize = fs(d.title)

  switch (li % 20) {
    // ── 0: 왼쪽 45% 컬러 패널 + 오른쪽 콘텐츠 ──
    case 0: return (
      <div style={{ display:'flex', width:W, height:W, background:t.bg, position:'relative' }}>
        {/* 왼쪽 컬러 패널 */}
        <div style={{ display:'flex', width:210, background:`linear-gradient(160deg,${t.c1},${t.c2})`, flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.7)', fontFamily:FF, marginBottom:8, textAlign:'center' }}>{site}</div>
          <div style={{ display:'flex', fontSize:13, color:'#fff', fontWeight:700, fontFamily:FF, textAlign:'center', lineHeight:1.3 }}>{title}</div>
        </div>
        {/* 오른쪽 콘텐츠 */}
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'20px 16px', justifyContent:'center', gap:12 }}>
          <TagBadge text={d.category} t={t} />
          <Content ct={ct} items={items} t={t} dark={true} />
          <div style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.35)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 1: 오른쪽 45% 컬러 패널 + 왼쪽 흰 콘텐츠 ──
    case 1: return (
      <div style={{ display:'flex', width:W, height:W, background:t.lt, position:'relative' }}>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'20px 16px', justifyContent:'center', gap:10 }}>
          <TagBadge text={d.category} t={t} />
          <div style={{ display:'flex', fontSize:fsize, color:'#1a1a1a', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <Content ct={ct} items={items} t={t} dark={false} />
        </div>
        <div style={{ display:'flex', width:190, background:`linear-gradient(200deg,${t.c2},${t.c1})`, flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:20 }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.8)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 2: 상단 55% 컬러 + 하단 콘텐츠 ──
    case 2: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:t.bg }}>
        <div style={{ display:'flex', height:270, background:`linear-gradient(135deg,${t.c1},${t.c2})`, flexDirection:'column', justifyContent:'flex-end', padding:24 }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.7)', fontFamily:FF, marginBottom:6 }}>{d.category.replace(/-/g,' ').toUpperCase()}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
        </div>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'14px 20px', justifyContent:'center', gap:12 }}>
          <Content ct={ct} items={items} t={t} dark={true} />
          <div style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.3)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 3: 하단 40% 컬러 + 상단 라이트 콘텐츠 ──
    case 3: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:t.lt }}>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'20px 22px', gap:10 }}>
          <TagBadge text={d.category} t={t} />
          <div style={{ display:'flex', fontSize:fsize, color:'#1a1a1a', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <Content ct={ct} items={items} t={t} dark={false} />
        </div>
        <div style={{ display:'flex', height:190, background:`linear-gradient(45deg,${t.c2},${t.c1})`, alignItems:'center', justifyContent:'center' }}>
          <div style={{ display:'flex', fontSize:13, color:'rgba(255,255,255,.85)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 4: 전면 그라데이션 + 중앙 제목 + 하단 스트립 ──
    case 4: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:`linear-gradient(135deg,${t.bg},${t.c2})` }}>
        <div style={{ display:'flex', flex:1, flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 30px', gap:14 }}>
          <div style={{ display:'flex', background:'rgba(255,255,255,.12)', borderRadius:8, padding:'4px 14px' }}>
            <span style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.9)', fontWeight:700, fontFamily:FF }}>{d.category.replace(/-/g,' ').toUpperCase()}</span>
          </div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, textAlign:'center', lineHeight:1.3 }}>{title}</div>
        </div>
        <div style={{ display:'flex', background:'rgba(0,0,0,.35)', padding:'12px 20px' }}>
          <HStrip items={items} t={t} dark={true} />
        </div>
      </div>
    )

    // ── 5: 라이트 배경 + 큰 제목 + 번호 목록 ──
    case 5: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:t.lt }}>
        <div style={{ display:'flex', height:6, background:t.c1 }} />
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'22px 24px', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', width:4, height:20, background:t.c1, borderRadius:2 }} />
            <span style={{ display:'flex', fontSize:11, color:t.c1, fontWeight:700, fontFamily:FF }}>{d.category.replace(/-/g,' ').toUpperCase()}</span>
          </div>
          <div style={{ display:'flex', fontSize:fsize, color:'#111', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <Content ct={ct} items={items} t={t} dark={false} />
        </div>
        <div style={{ display:'flex', padding:'8px 24px', borderTop:`1px solid rgba(0,0,0,.1)` }}>
          <span style={{ display:'flex', fontSize:10, color:'#888', fontFamily:FF }}>{site}</span>
        </div>
      </div>
    )

    // ── 6: 대각 왼쪽 (rotated div) + 오른쪽 콘텐츠 ──
    case 6: return (
      <div style={{ display:'flex', width:W, height:W, background:t.bg, position:'relative', overflow:'hidden' }}>
        {/* 대각 배경 */}
        <div style={{ position:'absolute', top:-60, left:-80, width:340, height:700, background:`linear-gradient(180deg,${t.c1},${t.c2})`, transform:'rotate(12deg)', display:'flex' }} />
        {/* 왼쪽 제목 (대각 영역) */}
        <div style={{ display:'flex', width:210, flexDirection:'column', justifyContent:'center', padding:24, zIndex:1 }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.7)', fontFamily:FF, marginBottom:8 }}>{d.category.replace(/-/g,' ')}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.3 }}>{title}</div>
        </div>
        {/* 오른쪽 콘텐츠 */}
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'18px 16px 18px 8px', justifyContent:'center', gap:10 }}>
          <Content ct={ct} items={items} t={t} dark={true} />
          <div style={{ display:'flex', fontSize:9, color:'rgba(255,255,255,.3)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 7: 대각 오른쪽 + 왼쪽 콘텐츠 ──
    case 7: return (
      <div style={{ display:'flex', width:W, height:W, background:t.lt, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-60, right:-80, width:340, height:700, background:`linear-gradient(180deg,${t.c1},${t.c2})`, transform:'rotate(-12deg)', display:'flex' }} />
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'20px 16px', justifyContent:'center', gap:12, zIndex:1 }}>
          <TagBadge text={d.category} t={t} />
          <div style={{ display:'flex', fontSize:fsize, color:'#111', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <Content ct={ct} items={items} t={t} dark={false} />
        </div>
        <div style={{ display:'flex', width:180, flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:20, zIndex:1 }}>
          <div style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.8)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 8: 왼쪽 60% 큰 패널 + 오른쪽 그리드 ──
    case 8: return (
      <div style={{ display:'flex', width:W, height:W, background:t.bg }}>
        <div style={{ display:'flex', width:300, background:`linear-gradient(160deg,${t.c2},${t.c1})`, flexDirection:'column', justifyContent:'center', padding:28 }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.6)', fontFamily:FF, marginBottom:10 }}>{d.category.replace(/-/g,' ').toUpperCase()}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.3 }}>{title}</div>
          <div style={{ display:'flex', height:2, width:50, background:'rgba(255,255,255,.4)', marginTop:14 }} />
          <div style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.5)', fontFamily:FF, marginTop:8 }}>{site}</div>
        </div>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:14, justifyContent:'center', gap:8 }}>
          <Grid2 items={items} t={t} dark={true} />
        </div>
      </div>
    )

    // ── 9: 상단 68% 밴드 + 하단 스트립 ──
    case 9: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:t.lt }}>
        <div style={{ display:'flex', height:310, background:`linear-gradient(135deg,${t.c1},${t.c2})`, flexDirection:'column', justifyContent:'space-between', padding:24 }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.7)', fontFamily:FF }}>{d.category.replace(/-/g,' ').toUpperCase()}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
        </div>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:16, gap:12 }}>
          <HStrip items={items} t={t} dark={false} />
          <div style={{ display:'flex', fontSize:10, color:'#aaa', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 10: 오른쪽 42% + 왼쪽 계단형 콘텐츠 ──
    case 10: return (
      <div style={{ display:'flex', width:W, height:W, background:t.bg }}>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'18px 14px', justifyContent:'center', gap:10 }}>
          <TagBadge text={d.category} t={t} />
          <Steps items={items} t={t} dark={true} />
          <div style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.3)', fontFamily:FF }}>{site}</div>
        </div>
        <div style={{ display:'flex', width:200, background:`linear-gradient(200deg,${t.c1},${t.c2})`, flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ display:'flex', fontSize:14, color:'#fff', fontWeight:700, fontFamily:FF, textAlign:'center', lineHeight:1.35 }}>{title}</div>
        </div>
      </div>
    )

    // ── 11: 하단 55% 컬러 + 상단 배지 ──
    case 11: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:t.lt }}>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'20px 20px', gap:10 }}>
          <TagBadge text={d.category} t={t} />
          <div style={{ display:'flex', fontSize:fsize, color:'#111', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <Badges items={items.slice(0,2)} t={t} dark={false} />
        </div>
        <div style={{ display:'flex', height:255, background:`linear-gradient(45deg,${t.c1},${t.c2})`, flexDirection:'column', padding:'16px 20px', gap:8, justifyContent:'center' }}>
          <Badges items={items.slice(2)} t={t} dark={true} />
          <div style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.6)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 12: 전면 그라데이션 + 수직 목록 ──
    case 12: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:`linear-gradient(160deg,${t.bg},${t.c2}CC)` }}>
        <div style={{ display:'flex', height:4, background:t.c3 }} />
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'20px 24px', gap:14 }}>
          <div style={{ display:'flex', fontSize:11, color:t.c3, fontWeight:700, fontFamily:FF }}>{d.category.replace(/-/g,' ').toUpperCase()}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <div style={{ display:'flex', height:1, background:'rgba(255,255,255,.2)' }} />
          <VList items={items} t={t} dark={true} />
        </div>
        <div style={{ display:'flex', padding:'8px 24px', justifyContent:'flex-end' }}>
          <span style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.35)', fontFamily:FF }}>{site}</span>
        </div>
      </div>
    )

    // ── 13: 대각 왼쪽 (넓은) + 오른쪽 2×2 그리드 ──
    case 13: return (
      <div style={{ display:'flex', width:W, height:W, background:t.bg, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-100, left:-120, width:400, height:800, background:`linear-gradient(180deg,${t.c1},${t.c2})`, transform:'rotate(10deg)', display:'flex' }} />
        <div style={{ display:'flex', width:240, flexDirection:'column', justifyContent:'flex-end', padding:24, zIndex:1 }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.7)', fontFamily:FF, marginBottom:6 }}>{d.category.replace(/-/g,' ')}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.3 }}>{title}</div>
        </div>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'14px 14px 14px 8px', justifyContent:'center', gap:8, zIndex:1 }}>
          <Grid2 items={items} t={t} dark={true} />
          <div style={{ display:'flex', fontSize:9, color:'rgba(255,255,255,.35)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 14: 라이트 + 테두리 그리드 카드 ──
    case 14: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:'#f8f9fa', border:`3px solid ${t.c1}`, borderRadius:0 }}>
        <div style={{ display:'flex', background:t.c1, padding:'12px 20px', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ display:'flex', fontSize:12, color:'#fff', fontWeight:700, fontFamily:FF }}>{d.category.replace(/-/g,' ').toUpperCase()}</span>
          <span style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.8)', fontFamily:FF }}>{site}</span>
        </div>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'14px 16px', gap:10 }}>
          <div style={{ display:'flex', fontSize:fsize, color:'#111', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <Grid2 items={items} t={t} dark={false} />
        </div>
      </div>
    )

    // ── 15: 왼쪽 좁은 컬러 바 + 배지 목록 ──
    case 15: return (
      <div style={{ display:'flex', width:W, height:W, background:t.lt }}>
        <div style={{ display:'flex', width:5, background:t.c1 }} />
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'22px 18px', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', width:30, height:30, borderRadius:15, background:t.c1, alignItems:'center', justifyContent:'center' }}>
              <span style={{ display:'flex', fontSize:14, color:'#fff', fontWeight:700, fontFamily:FF }}>★</span>
            </div>
            <span style={{ display:'flex', fontSize:11, color:t.c1, fontWeight:700, fontFamily:FF }}>{d.category.replace(/-/g,' ').toUpperCase()}</span>
          </div>
          <div style={{ display:'flex', fontSize:fsize, color:'#111', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <Badges items={items} t={t} dark={false} />
          <div style={{ display:'flex', fontSize:9, color:'#bbb', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 16: 오른쪽 60% 패널 + 왼쪽 소제목 목록 ──
    case 16: return (
      <div style={{ display:'flex', width:W, height:W, background:t.bg }}>
        <div style={{ display:'flex', width:200, flexDirection:'column', padding:'20px 14px 20px 18px', justifyContent:'center', gap:10 }}>
          <TagBadge text={d.category} t={t} />
          <VList items={items} t={t} dark={true} />
        </div>
        <div style={{ display:'flex', flex:1, background:`linear-gradient(160deg,${t.c1},${t.c2})`, flexDirection:'column', justifyContent:'flex-end', padding:24 }}>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.3 }}>{title}</div>
          <div style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.5)', fontFamily:FF, marginTop:8 }}>{site}</div>
        </div>
      </div>
    )

    // ── 17: 상단 42% + 배지 행 ──
    case 17: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:t.lt }}>
        <div style={{ display:'flex', height:200, background:`linear-gradient(135deg,${t.c1},${t.c2})`, flexDirection:'column', justifyContent:'center', padding:'24px 24px' }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.7)', fontFamily:FF, marginBottom:8 }}>{d.category.replace(/-/g,' ').toUpperCase()}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
        </div>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'14px 20px', gap:12 }}>
          <Badges items={items} t={t} dark={false} />
          <div style={{ display:'flex', fontSize:9, color:'#bbb', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 18: 하단 35% 밴드 + 상단 가로 스트립 ──
    case 18: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:t.bg }}>
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'20px 22px', gap:12 }}>
          <div style={{ display:'flex', fontSize:11, color:t.c3, fontWeight:700, fontFamily:FF }}>{d.category.replace(/-/g,' ').toUpperCase()}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <HStrip items={items} t={t} dark={true} />
        </div>
        <div style={{ display:'flex', height:170, background:`linear-gradient(45deg,${t.c2},${t.c1})`, alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ display:'flex', fontSize:12, color:'rgba(255,255,255,.8)', fontFamily:FF }}>{site}</div>
        </div>
      </div>
    )

    // ── 19: 전면 그라데이션 + 계단형 ──
    default: return (
      <div style={{ display:'flex', width:W, height:W, flexDirection:'column', background:`linear-gradient(135deg,${t.c1},${t.c2})` }}>
        <div style={{ display:'flex', height:4, background:'rgba(255,255,255,.4)' }} />
        <div style={{ display:'flex', flex:1, flexDirection:'column', padding:'20px 24px', gap:14 }}>
          <div style={{ display:'flex', fontSize:11, color:'rgba(255,255,255,.75)', fontFamily:FF }}>{d.category.replace(/-/g,' ').toUpperCase()}</div>
          <div style={{ display:'flex', fontSize:fsize, color:'#fff', fontWeight:700, fontFamily:FF, lineHeight:1.25 }}>{title}</div>
          <div style={{ display:'flex', height:1, background:'rgba(255,255,255,.3)' }} />
          <Steps items={items} t={t} dark={true} />
        </div>
        <div style={{ display:'flex', padding:'8px 24px', justifyContent:'flex-end' }}>
          <span style={{ display:'flex', fontSize:10, color:'rgba(255,255,255,.4)', fontFamily:FF }}>{site}</span>
        </div>
      </div>
    )
  }
}

// ── 메인 생성 함수 ──────────────────────────────────────────────────────────
export async function generateCardImage(data: CardData): Promise<Buffer> {
  const theme = THEMES[data.category] || DT
  const li = (data.layout ?? 0) % 20
  const ct = CTMAP[(data.variant ?? 0) % CTMAP.length]
  const fonts = loadFonts()

  const element = makeLayout(li, data, theme, ct)

  // ── 모바일 최적화: 1080x1080 업스케일 ──
  // 기존 500px 디자인을 2.16배 확대하여 고해상도(1080px) 출력
  // CSS transform scale을 활용해 모든 레이아웃 코드 변경 없이 업스케일
  const FINAL_W = 1080
  const SCALE = FINAL_W / W  // 1080/500 = 2.16

  const scaledElement = React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        width: FINAL_W,
        height: FINAL_W,
        overflow: 'hidden',
        background: theme.bg,
      },
    },
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          transform: `scale(${SCALE.toFixed(4)})`,
          transformOrigin: 'top left',
          width: W,
          height: W,
          flexShrink: 0,
        },
      },
      element as React.ReactElement
    )
  )

  // ImageResponse: next/og 내장 (WASM 기반 SVG→PNG, Vercel 호환)
  const response = new ImageResponse(scaledElement, {
    width: FINAL_W,
    height: FINAL_W,
    fonts: fonts.length > 0 ? fonts : [
      { name: 'NS', data: new ArrayBuffer(0), weight: 400, style: 'normal' },
    ],
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
