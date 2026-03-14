#!/usr/bin/env node
// 이미지 생성 마이크로서비스 - 포트 3001
// Next.js Turbopack이 native .node 바이너리를 지원하지 않아 별도 서버로 분리

import http from 'http'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

const PORT = 3001

// 카테고리별 색상 테마
const THEMES = {
  'skin-care':         { bg1: '#0D1B2A', bg2: '#1B3A4B', accent: '#4FC3F7', badge: '#1976D2' },
  'medical-procedure': { bg1: '#1A0A2E', bg2: '#2D1B69', accent: '#CE93D8', badge: '#7B1FA2' },
  'dental':            { bg1: '#0A1628', bg2: '#1A3A5C', accent: '#64B5F6', badge: '#1565C0' },
  'anti-aging':        { bg1: '#0A0A0A', bg2: '#1A1A2E', accent: '#FFB347', badge: '#E65100' },
  'supplements':       { bg1: '#0D2818', bg2: '#1B4332', accent: '#69DB7C', badge: '#2E7D32' },
  'beauty':            { bg1: '#2D0A1E', bg2: '#4A1942', accent: '#F48FB1', badge: '#C2185B' },
  'health':            { bg1: '#0A1628', bg2: '#0D3B6E', accent: '#4FC3F7', badge: '#01579B' },
  'lifestyle':         { bg1: '#1B2A1B', bg2: '#2D4A2D', accent: '#A5D6A7', badge: '#388E3C' },
  'functional-food':   { bg1: '#2A1500', bg2: '#4A2800', accent: '#FFCC80', badge: '#E65100' },
  'diet-clinic':       { bg1: '#1A0A2E', bg2: '#311B92', accent: '#B39DDB', badge: '#4527A0' },
  'cancer-prevention': { bg1: '#0A2018', bg2: '#1B4332', accent: '#80CBC4', badge: '#00695C' },
  'mental-health':     { bg1: '#0A1628', bg2: '#1A237E', accent: '#9FA8DA', badge: '#283593' },
  'medical-tourism':   { bg1: '#0D1B2A', bg2: '#1A3A5C', accent: '#80DEEA', badge: '#00838F' },
}
const DEFAULT_THEME = { bg1: '#0D1B2A', bg2: '#1B3A4B', accent: '#4FC3F7', badge: '#1976D2' }

// Windows 시스템 폰트 등록 (최초 1회)
let fontsRegistered = false
function ensureFonts() {
  if (fontsRegistered) return
  const winFonts = [
    { file: 'C:\\Windows\\Fonts\\malgun.ttf',   family: 'Malgun Gothic' },
    { file: 'C:\\Windows\\Fonts\\malgunbd.ttf', family: 'Malgun Gothic' },
    { file: 'C:\\Windows\\Fonts\\YuGothR.ttc',  family: 'Yu Gothic' },
    { file: 'C:\\Windows\\Fonts\\segoeui.ttf',  family: 'Segoe UI' },
    { file: 'C:\\Windows\\Fonts\\segoeuib.ttf', family: 'Segoe UI' },
  ]
  for (const f of winFonts) {
    try { GlobalFonts.registerFromPath(f.file, f.family); console.log('✅ 폰트 등록:', f.family) }
    catch(e) { console.log('⚠ 폰트 없음:', f.file) }
  }
  fontsRegistered = true
}

function getFont(lang) {
  if (lang === 'ko') return '"Malgun Gothic", sans-serif'
  if (lang === 'ja') return '"Yu Gothic", "MS Gothic", sans-serif'
  return '"Segoe UI", Arial, sans-serif'
}

function wrapCJK(ctx, text, maxW) {
  const isCJK = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(text)
  if (!isCJK) {
    const words = text.split(' '), lines = []
    let cur = ''
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w } else cur = t
    }
    if (cur) lines.push(cur)
    return lines
  }
  const lines = []; let line = ''
  for (const ch of text) {
    const t = line + ch
    if (ctx.measureText(t).width > maxW) { if (line) lines.push(line); line = ch } else line = t
  }
  if (line) lines.push(line)
  return lines
}

// ── 테마 + 레이아웃 선택 헬퍼 ──
function resolveTheme(data) {
  const DIVERSE_VARIANTS = [
    null, 'supplements', 'beauty', 'anti-aging',
    'cancer-prevention', 'diet-clinic', 'functional-food', 'medical-procedure',
  ]
  if (data.variant != null && !isNaN(Number(data.variant))) {
    const v = Number(data.variant)
    const key = DIVERSE_VARIANTS[v % DIVERSE_VARIANTS.length]
    return key ? THEMES[key] : (THEMES[data.category] || DEFAULT_THEME)
  }
  return THEMES[data.category] || DEFAULT_THEME
}

// ── Layout 0: 원형 장식 + 오른쪽 정보 (기존 디자인) ──
function layout0(ctx, W, H, theme, font, data) {
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, theme.bg1); grad.addColorStop(1, theme.bg2)
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

  const [cx, cy] = [160, 315]
  ctx.beginPath(); ctx.arc(cx, cy, 130, 0, Math.PI*2); ctx.fillStyle = theme.accent+'18'; ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy, 88, 0, Math.PI*2); ctx.fillStyle = theme.accent+'28'; ctx.fill()
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 88)
  glow.addColorStop(0, theme.accent+'55'); glow.addColorStop(1, theme.accent+'00')
  ctx.beginPath(); ctx.arc(cx, cy, 88, 0, Math.PI*2); ctx.fillStyle = glow; ctx.fill()
  ctx.strokeStyle = theme.accent+'AA'; ctx.lineWidth = 7; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(cx-36,cy); ctx.lineTo(cx+36,cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx,cy-36); ctx.lineTo(cx,cy+36); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(320,40); ctx.lineTo(320,H-40)
  ctx.strokeStyle = theme.accent+'33'; ctx.lineWidth=1; ctx.stroke()

  const lx=360, rw=800; let y=70
  const badge = (data.category.replace(/-/g,' ').toUpperCase())
  ctx.font = `bold 13px ${font}`
  const bw = ctx.measureText(badge).width + 28
  ctx.beginPath(); ctx.roundRect(lx, y, bw, 30, 6); ctx.fillStyle=theme.badge; ctx.fill()
  ctx.fillStyle='#fff'; ctx.textBaseline='middle'; ctx.fillText(badge, lx+14, y+15); y+=48

  ctx.font=`bold 36px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.textBaseline='top'
  wrapCJK(ctx, data.title, rw-20).forEach(l => { ctx.fillText(l,lx,y); y+=48 }); y+=4
  if(data.subtitle) {
    ctx.font=`19px ${font}`; ctx.fillStyle=theme.accent+'CC'
    wrapCJK(ctx, data.subtitle, rw-20).forEach(l => { ctx.fillText(l,lx,y); y+=28 }); y+=4
  }
  ctx.beginPath(); ctx.moveTo(lx,y); ctx.lineTo(lx+rw,y); ctx.strokeStyle=theme.accent+'55'; ctx.lineWidth=1.5; ctx.stroke(); y+=24
  ;(data.points||[]).slice(0,3).forEach((pt,i,arr) => {
    ctx.font=`13px ${font}`; ctx.fillStyle='#888888'; ctx.fillText(pt.label,lx,y); y+=22
    ctx.font=`bold 26px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.fillText(pt.value,lx,y); y+=36
    if(i<arr.length-1){ctx.beginPath();ctx.moveTo(lx,y+4);ctx.lineTo(lx+rw,y+4);ctx.strokeStyle='#FFFFFF11';ctx.lineWidth=1;ctx.stroke();y+=14}
  })
  const by=H-42; ctx.beginPath(); ctx.moveTo(lx,by); ctx.lineTo(lx+rw,by); ctx.strokeStyle='#FFFFFF22'; ctx.lineWidth=1; ctx.stroke()
  ctx.font=`12px ${font}`; ctx.fillStyle='#555555'; ctx.textBaseline='middle'
  ctx.fillText(`${data.category}  ·  ${data.siteName||'seo-writer'}`, lx, by+14)
}

// ── Layout 1: 굵은 왼쪽 컬러 블록 + 오른쪽 콘텐츠 ──
function layout1(ctx, W, H, theme, font, data) {
  ctx.fillStyle = theme.bg1; ctx.fillRect(0, 0, W, H)
  // 왼쪽 강조 블록
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, theme.badge); grad.addColorStop(1, theme.bg2)
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 380, H)
  // 사선 장식
  ctx.fillStyle = theme.accent+'22'
  ctx.beginPath(); ctx.moveTo(340,0); ctx.lineTo(380,0); ctx.lineTo(380,H); ctx.lineTo(280,H); ctx.closePath(); ctx.fill()

  // 왼쪽 세로 텍스트
  ctx.save(); ctx.translate(55, H/2); ctx.rotate(-Math.PI/2)
  ctx.font=`bold 14px ${font}`; ctx.fillStyle=theme.accent+'AA'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(), 0, 0)
  ctx.restore()
  // 왼쪽 아이콘 원
  ctx.beginPath(); ctx.arc(190, H/2, 80, 0, Math.PI*2); ctx.strokeStyle=theme.accent+'44'; ctx.lineWidth=2; ctx.stroke()
  ctx.beginPath(); ctx.arc(190, H/2, 55, 0, Math.PI*2); ctx.fillStyle=theme.accent+'22'; ctx.fill()
  ctx.font=`bold 42px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText((data.points?.[0]?.value||'★').slice(0,4), 190, H/2)

  // 오른쪽 콘텐츠
  const lx=420, rw=W-lx-40; let y=60; ctx.textAlign='left'
  const badge = data.category.replace(/-/g,' ').toUpperCase()
  ctx.font=`bold 12px ${font}`
  const bw = ctx.measureText(badge).width+24
  ctx.beginPath(); ctx.roundRect(lx,y,bw,26,4); ctx.fillStyle=theme.accent; ctx.fill()
  ctx.fillStyle=theme.bg1; ctx.textBaseline='middle'; ctx.fillText(badge, lx+12, y+13); y+=44

  ctx.font=`bold 34px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.textBaseline='top'
  wrapCJK(ctx,data.title,rw).forEach(l=>{ctx.fillText(l,lx,y);y+=46}); y+=8
  if(data.subtitle){ctx.font=`17px ${font}`;ctx.fillStyle=theme.accent+'BB';wrapCJK(ctx,data.subtitle,rw).forEach(l=>{ctx.fillText(l,lx,y);y+=26});y+=8}

  ctx.beginPath();ctx.moveTo(lx,y);ctx.lineTo(W-40,y);ctx.strokeStyle=theme.accent+'44';ctx.lineWidth=1;ctx.stroke();y+=20
  ;(data.points||[]).slice(1,3).forEach(pt=>{
    ctx.font=`12px ${font}`;ctx.fillStyle='#666666';ctx.fillText(pt.label,lx,y);y+=18
    ctx.font=`bold 22px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value,lx,y);y+=34
  })
  ctx.font=`11px ${font}`;ctx.fillStyle='#444444';ctx.textBaseline='bottom'
  ctx.fillText(data.siteName||'seo-writer', lx, H-20)
}

// ── Layout 2: 상단 배너 + 중앙 제목 + 하단 정보 스트립 ──
function layout2(ctx, W, H, theme, font, data) {
  ctx.fillStyle = theme.bg1; ctx.fillRect(0, 0, W, H)
  // 상단 배너
  ctx.fillStyle = theme.badge; ctx.fillRect(0, 0, W, 70)
  ctx.font=`bold 14px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.textBaseline='middle'; ctx.textAlign='left'
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(), 40, 35)
  ctx.textAlign='right'; ctx.fillText(data.siteName||'seo-writer', W-40, 35)

  // 중앙 배경 장식
  const mid = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 350)
  mid.addColorStop(0, theme.accent+'18'); mid.addColorStop(1, theme.bg1+'00')
  ctx.fillStyle = mid; ctx.fillRect(0, 70, W, H-150)

  // 메인 타이틀 (가운데 정렬)
  ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillStyle='#FFFFFF'
  let y = 110
  const tLines = wrapCJK(ctx, data.title, W-160); // temp measure
  ctx.font=`bold 42px ${font}`
  // 다시 측정
  const measLines = wrapCJK({measureText:(t)=>({width:t.length*24})}, data.title, W-160)
  const lineCount = Math.min(tLines.length, 3)
  ctx.font=`bold ${lineCount>2?34:42}px ${font}`
  tLines.slice(0,3).forEach(l=>{ctx.fillText(l,W/2,y);y+=lineCount>2?46:56})
  y+=8
  if(data.subtitle){ctx.font=`19px ${font}`;ctx.fillStyle=theme.accent+'CC';ctx.textAlign='center';ctx.fillText(data.subtitle.slice(0,40),W/2,y)}

  // 하단 정보 스트립
  const stripY = H-100
  const grad2 = ctx.createLinearGradient(0,0,W,0)
  grad2.addColorStop(0,theme.badge+'EE'); grad2.addColorStop(1,theme.bg2+'EE')
  ctx.fillStyle=grad2; ctx.fillRect(0, stripY, W, 100)
  const pts = (data.points||[]).slice(0,3)
  const colW = W/pts.length
  pts.forEach((pt,i)=>{
    const cx2 = colW*i + colW/2
    if(i>0){ctx.beginPath();ctx.moveTo(colW*i,stripY+15);ctx.lineTo(colW*i,H-15);ctx.strokeStyle='#FFFFFF22';ctx.lineWidth=1;ctx.stroke()}
    ctx.font=`11px ${font}`;ctx.fillStyle='#FFFFFF99';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(pt.label,cx2,stripY+14)
    ctx.font=`bold 20px ${font}`;ctx.fillStyle='#FFFFFF';ctx.fillText(pt.value.slice(0,12),cx2,stripY+36)
  })
}

// ── Layout 3: 우측 사선 컬러 패널 ──
function layout3(ctx, W, H, theme, font, data) {
  ctx.fillStyle = theme.bg1; ctx.fillRect(0, 0, W, H)
  // 오른쪽 사선 패널
  ctx.beginPath(); ctx.moveTo(W*0.55,0); ctx.lineTo(W,0); ctx.lineTo(W,H); ctx.lineTo(W*0.38,H); ctx.closePath()
  const gp = ctx.createLinearGradient(W*0.55, 0, W, H)
  gp.addColorStop(0, theme.badge); gp.addColorStop(1, theme.bg2)
  ctx.fillStyle=gp; ctx.fill()

  // 점 패턴 장식 (우측 패널)
  for(let r=0;r<6;r++) for(let c=0;c<4;c++) {
    ctx.beginPath(); ctx.arc(W*0.68+c*55, 80+r*85, 3, 0, Math.PI*2)
    ctx.fillStyle=theme.accent+'33'; ctx.fill()
  }
  // 우측 이미지 숫자 장식
  ctx.font=`bold 140px ${font}`; ctx.fillStyle=theme.accent+'18'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText((data.points?.[0]?.value||'No.1').slice(0,5), W*0.78, H/2)

  // 왼쪽 콘텐츠
  const lx=50, rw=W*0.52; let y=70; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 13px ${font}`
  const badge = data.category.replace(/-/g,' ').toUpperCase()
  const bw=ctx.measureText(badge).width+24
  ctx.beginPath();ctx.roundRect(lx,y,bw,28,6);ctx.fillStyle=theme.accent;ctx.fill()
  ctx.fillStyle=theme.bg1;ctx.textBaseline='middle';ctx.fillText(badge,lx+12,y+14);y+=48

  ctx.font=`bold 38px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.textBaseline='top'
  wrapCJK(ctx,data.title,rw-20).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=50}); y+=10
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle=theme.accent+'CC';wrapCJK(ctx,data.subtitle,rw-20).slice(0,2).forEach(l=>{ctx.fillText(l,lx,y);y+=26})}

  ctx.beginPath();ctx.moveTo(lx,H-60);ctx.lineTo(rw-20,H-60);ctx.strokeStyle=theme.accent+'33';ctx.lineWidth=1;ctx.stroke()
  ctx.font=`12px ${font}`;ctx.fillStyle='#555555';ctx.textBaseline='middle';ctx.fillText(data.siteName||'seo-writer',lx,H-40)
}

// ── Layout 4: 미니멀 굵은 악센트 바 ──
function layout4(ctx, W, H, theme, font, data) {
  // 배경 그라데이션 (위→아래)
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, theme.bg2); grad.addColorStop(1, theme.bg1)
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H)

  // 굵은 상단 악센트 바
  ctx.fillStyle=theme.accent; ctx.fillRect(0,0,W,12)
  // 점선 하이라이트 원호
  ctx.beginPath(); ctx.arc(W-120, -60, 260, 0, Math.PI/2)
  ctx.strokeStyle=theme.accent+'22'; ctx.lineWidth=60; ctx.stroke()

  // 가로 구분선들
  ctx.strokeStyle=theme.accent+'15'; ctx.lineWidth=1
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,H/4*i);ctx.lineTo(W,H/4*i);ctx.stroke()}

  const lx=70; let y=55; ctx.textAlign='left'
  // 카테고리 뱃지 (아웃라인 스타일)
  const badge=data.category.replace(/-/g,' ').toUpperCase()
  ctx.font=`bold 12px ${font}`
  const bw=ctx.measureText(badge).width+24
  ctx.beginPath();ctx.roundRect(lx,y,bw,26,4);ctx.strokeStyle=theme.accent;ctx.lineWidth=2;ctx.stroke()
  ctx.fillStyle=theme.accent;ctx.textBaseline='middle';ctx.fillText(badge,lx+12,y+13);y+=50

  ctx.font=`bold 44px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.textBaseline='top'
  wrapCJK(ctx,data.title,W-lx*2-100).slice(0,2).forEach(l=>{ctx.fillText(l,lx,y);y+=58}); y+=12

  // 악센트 색상 가로 바
  ctx.fillStyle=theme.accent; ctx.fillRect(lx,y,80,5); y+=20
  if(data.subtitle){ctx.font=`20px ${font}`;ctx.fillStyle=theme.accent+'CC';ctx.textBaseline='top';ctx.fillText(data.subtitle.slice(0,50),lx,y);y+=36}

  // 하단 포인트 칩들
  y=H-90
  ;(data.points||[]).slice(0,3).forEach((pt,i)=>{
    const chipX = lx + i*(W-lx*2)/3
    ctx.fillStyle=theme.badge+'88'; ctx.beginPath(); ctx.roundRect(chipX,y,(W-lx*2)/3-16,62,8); ctx.fill()
    ctx.font=`11px ${font}`;ctx.fillStyle='#888888';ctx.textBaseline='top';ctx.fillText(pt.label,chipX+10,y+10)
    ctx.font=`bold 18px ${font}`;ctx.fillStyle='#FFFFFF';ctx.fillText(pt.value.slice(0,10),chipX+10,y+30)
  })
  ctx.font=`11px ${font}`;ctx.fillStyle='#333333';ctx.textBaseline='bottom';ctx.textAlign='right'
  ctx.fillText(data.siteName||'seo-writer', W-lx, H-10)
}


// ── Layout 5: 중앙 프로스티드 카드 ──
function layout5(ctx, W, H, theme, font, data) {
  const g = ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,theme.bg2); g.addColorStop(1,theme.bg1)
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
  // 대각선 장식 라인들
  ctx.strokeStyle=theme.accent+'22'; ctx.lineWidth=1
  for(let i=-5;i<20;i++){ctx.beginPath();ctx.moveTo(i*80,0);ctx.lineTo(i*80+H,H);ctx.stroke()}
  // 중앙 반투명 카드
  ctx.fillStyle=theme.bg1+'CC'; ctx.beginPath(); ctx.roundRect(W/2-360,60,720,510,20); ctx.fill()
  ctx.strokeStyle=theme.accent+'44'; ctx.lineWidth=2; ctx.stroke()
  // 내용
  ctx.textAlign='center'; let y=110
  ctx.font=`bold 13px ${font}`; ctx.fillStyle=theme.accent; ctx.textBaseline='top'
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(), W/2, y); y+=28
  ctx.beginPath(); ctx.moveTo(W/2-100,y); ctx.lineTo(W/2+100,y); ctx.strokeStyle=theme.accent+'55'; ctx.lineWidth=1; ctx.stroke(); y+=16
  ctx.font=`bold 38px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,640).slice(0,3).forEach(l=>{ctx.fillText(l,W/2,y);y+=50}); y+=8
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle=theme.accent+'CC';ctx.fillText(data.subtitle,W/2,y);y+=30}
  ctx.font=`11px ${font}`; ctx.fillStyle='#444'; ctx.textBaseline='bottom'; ctx.fillText(data.siteName||'seo-writer',W/2,H-30)
}

// ── Layout 6: 매거진 - 거대 배경 글자 ──
function layout6(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 배경 대형 텍스트 장식
  ctx.font=`bold 180px ${font}`; ctx.fillStyle=theme.accent+'09'; ctx.textAlign='left'; ctx.textBaseline='middle'
  ctx.fillText(data.category.slice(0,3).toUpperCase(), -10, H/2)
  // 상단 색상 바
  ctx.fillStyle=theme.badge; ctx.fillRect(0,0,W,8)
  const lx=60; let y=40; ctx.textAlign='left'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.accent; ctx.textBaseline='top'
  ctx.fillText('● '+data.category.replace(/-/g,' ').toUpperCase(), lx, y); y+=28
  ctx.font=`bold 50px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-lx-60).slice(0,2).forEach(l=>{ctx.fillText(l,lx,y);y+=62}); y+=10
  ctx.fillStyle=theme.accent; ctx.fillRect(lx,y,60,4); y+=16
  if(data.subtitle){ctx.font=`20px ${font}`;ctx.fillStyle='#AAAAAA';ctx.fillText(data.subtitle,lx,y);y+=30}
  ctx.beginPath(); ctx.moveTo(lx,H-80); ctx.lineTo(W-60,H-80); ctx.strokeStyle=theme.accent+'33'; ctx.lineWidth=1; ctx.stroke()
  const pts=(data.points||[]).slice(0,3); const cw=(W-lx-60)/pts.length
  pts.forEach((pt,i)=>{const x=lx+i*cw;ctx.font=`10px ${font}`;ctx.fillStyle='#555';ctx.fillText(pt.label,x,H-65);ctx.font=`bold 16px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,12),x,H-45)})
}

// ── Layout 7: 수평 반반 분할 ──
function layout7(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.badge; ctx.fillRect(0,0,W,H/2)
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,H/2,W,H/2)
  // 상단: 큰 제목
  ctx.textAlign='center'; ctx.fillStyle='#FFFFFF'; ctx.font=`bold 40px ${font}`; ctx.textBaseline='middle'
  const tLines=wrapCJK(ctx,data.title,W-120); const tH=tLines.length*52
  let ty=(H/2-tH)/2
  tLines.slice(0,2).forEach(l=>{ctx.fillText(l,W/2,ty);ty+=52})
  // 하단: 포인트 3개
  const pts=(data.points||[]).slice(0,3); const cw=W/pts.length
  pts.forEach((pt,i)=>{
    const cx=cw*i+cw/2; const cy=H/2+H/4
    if(i>0){ctx.beginPath();ctx.moveTo(cw*i,H/2+30);ctx.lineTo(cw*i,H-30);ctx.strokeStyle='#FFFFFF22';ctx.lineWidth=1;ctx.stroke()}
    ctx.font=`11px ${font}`;ctx.fillStyle='#666';ctx.fillText(pt.label,cx,H/2+50)
    ctx.font=`bold 22px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,12),cx,H/2+78)
  })
  if(data.subtitle){ctx.font=`15px ${font}`;ctx.fillStyle='#FFFFFF99';ctx.textBaseline='top';ctx.fillText(data.subtitle,W/2,H/2+20)}
}

// ── Layout 8: 네온 테두리 글로우 ──
function layout8(ctx, W, H, theme, font, data) {
  ctx.fillStyle='#050510'; ctx.fillRect(0,0,W,H)
  // 네온 테두리 글로우
  for(let i=6;i>0;i--){
    ctx.strokeStyle=theme.accent+(i*15).toString(16).padStart(2,'0')
    ctx.lineWidth=i*2; ctx.beginPath(); ctx.roundRect(20+i*3,20+i*3,W-40-i*6,H-40-i*6,12); ctx.stroke()
  }
  ctx.strokeStyle=theme.accent; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(38,38,W-76,H-76,10); ctx.stroke()
  // 코너 장식
  const corners=[[50,50],[W-50,50],[50,H-50],[W-50,H-50]]
  corners.forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,8,0,Math.PI*2);ctx.fillStyle=theme.accent;ctx.fill()})
  // 내용
  ctx.textAlign='center'; let y=100; ctx.textBaseline='top'
  ctx.font=`bold 12px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(), W/2, y); y+=30
  ctx.font=`bold 40px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-180).slice(0,3).forEach(l=>{ctx.fillText(l,W/2,y);y+=52}); y+=10
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle=theme.accent+'AA';ctx.fillText(data.subtitle,W/2,y)}
  ctx.font=`11px ${font}`;ctx.fillStyle='#444';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',W/2,H-50)
}

// ── Layout 9: 하단 삼각형 + 텍스트 상단 ──
function layout9(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 하단 큰 삼각형
  ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(W,H*0.4); ctx.lineTo(W,H); ctx.closePath()
  const gp=ctx.createLinearGradient(0,H*0.4,W,H); gp.addColorStop(0,theme.badge); gp.addColorStop(1,theme.bg2)
  ctx.fillStyle=gp; ctx.fill()
  // 상단 내용
  const lx=70; let y=60; ctx.textAlign='left'; ctx.textBaseline='top'
  const badge=data.category.replace(/-/g,' ').toUpperCase()
  ctx.font=`bold 12px ${font}`
  const bw=ctx.measureText(badge).width+20
  ctx.beginPath();ctx.roundRect(lx,y,bw,26,5);ctx.fillStyle=theme.accent;ctx.fill()
  ctx.fillStyle=theme.bg1;ctx.textBaseline='middle';ctx.fillText(badge,lx+10,y+13);y+=42
  ctx.font=`bold 42px ${font}`;ctx.fillStyle='#FFFFFF';ctx.textBaseline='top'
  wrapCJK(ctx,data.title,W-lx-80).slice(0,2).forEach(l=>{ctx.fillText(l,lx,y);y+=54}); y+=8
  if(data.subtitle){ctx.font=`19px ${font}`;ctx.fillStyle='#AAAAAA';ctx.fillText(data.subtitle,lx,y)}
  ctx.font=`11px ${font}`;ctx.fillStyle=theme.bg1+'99';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',lx,H-20)
}

// ── Layout 10: 원형 버블들 배경 ──
function layout10(ctx, W, H, theme, font, data) {
  const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,theme.bg1); g.addColorStop(1,theme.bg2)
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
  // 버블 장식
  [[900,100,200],[1050,350,130],[1100,550,90],[800,500,60],[1000,200,50]].forEach(([x,y,r])=>{
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.strokeStyle=theme.accent+'22';ctx.lineWidth=2;ctx.stroke()
    ctx.beginPath();ctx.arc(x,y,r*0.6,0,Math.PI*2);ctx.fillStyle=theme.accent+'11';ctx.fill()
  })
  const lx=60; let y=70; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.badge; ctx.fillRect(lx,y,3,60)
  ctx.fillStyle=theme.accent; ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx+14,y); y+=22
  ctx.font=`bold 40px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,700).slice(0,3).forEach(l=>{ctx.fillText(l,lx+14,y);y+=50}); y+=8
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx+14,y);y+=28}
  ctx.beginPath();ctx.moveTo(lx+14,y+10);ctx.lineTo(700,y+10);ctx.strokeStyle=theme.accent+'33';ctx.lineWidth=1;ctx.stroke()
  ctx.font=`11px ${font}`;ctx.fillStyle='#444';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',lx+14,H-20)
}

// ── Layout 11: 코너 브래킷 장식 ──
function layout11(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg2; ctx.fillRect(0,0,W,H)
  const pad=40, bLen=80, bW=5, c=theme.accent
  // 4개 코너 브래킷
  [[pad,pad,1,1],[W-pad,pad,-1,1],[pad,H-pad,1,-1],[W-pad,H-pad,-1,-1]].forEach(([x,y,dx,dy])=>{
    ctx.strokeStyle=c;ctx.lineWidth=bW
    ctx.beginPath();ctx.moveTo(x,y+dy*bLen);ctx.lineTo(x,y);ctx.lineTo(x+dx*bLen,y);ctx.stroke()
  })
  ctx.textAlign='center'; let y=120; ctx.textBaseline='top'
  ctx.font=`bold 12px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),W/2,y); y+=28
  ctx.font=`bold 40px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-200).slice(0,3).forEach(l=>{ctx.fillText(l,W/2,y);y+=52}); y+=8
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,W/2,y);y+=28}
  ctx.font=`11px ${font}`;ctx.fillStyle='#444';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',W/2,H-55)
}

// ── Layout 12: 인용문 스타일 ──
function layout12(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 큰 인용 따옴표
  ctx.font=`bold 200px ${font}`; ctx.fillStyle=theme.accent+'15'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText('"',30,-30)
  // 왼쪽 색상 바
  ctx.fillStyle=theme.badge; ctx.fillRect(0,0,6,H)
  const lx=60; let y=80; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`italic bold 38px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-lx-80).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=50}); y+=16
  ctx.beginPath();ctx.moveTo(lx,y);ctx.lineTo(lx+120,y);ctx.strokeStyle=theme.accent;ctx.lineWidth=3;ctx.stroke(); y+=20
  if(data.subtitle){ctx.font=`20px ${font}`;ctx.fillStyle=theme.accent+'CC';ctx.fillText(data.subtitle,lx,y);y+=30}
  ctx.font=`12px ${font}`; ctx.fillStyle='#555'; ctx.fillText(`— ${data.category.replace(/-/g,' ')} 전문 콘텐츠`,lx,y+10)
  ctx.textBaseline='bottom'; ctx.fillText(data.siteName||'seo-writer',W-60,H-20); ctx.textAlign='right'
}

// ── Layout 13: 상단 1/3 컬러 블록 ──
function layout13(ctx, W, H, theme, font, data) {
  const splitY=H*0.38
  ctx.fillStyle=theme.badge; ctx.fillRect(0,0,W,splitY)
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,splitY,W,H-splitY)
  // 오버랩 장식 원
  ctx.beginPath();ctx.arc(W*0.8,splitY,80,0,Math.PI*2)
  ctx.fillStyle=theme.accent+'22'; ctx.fill()
  ctx.beginPath();ctx.arc(W*0.8,splitY,50,0,Math.PI*2)
  ctx.strokeStyle=theme.accent+'55'; ctx.lineWidth=2; ctx.stroke()
  // 상단
  ctx.textAlign='left'; const lx=60
  ctx.font=`bold 13px ${font}`; ctx.fillStyle='#FFFFFF99'; ctx.textBaseline='top'
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx,30)
  // 맞닿는 지점 제목
  ctx.font=`bold 36px ${font}`; ctx.fillStyle='#FFFFFF'
  let y=splitY-60
  wrapCJK(ctx,data.title,W*0.72-lx).slice(0,1).forEach(l=>{ctx.fillText(l,lx,y)})
  // 하단
  y=splitY+30; ctx.font=`bold 26px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-lx*2).slice(1,3).forEach(l=>{ctx.fillText(l,lx,y);y+=36}); y+=10
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx,y);y+=26}
  ctx.font=`11px ${font}`;ctx.fillStyle='#444';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',lx,H-20)
}

// ── Layout 14: 대각선 컬러 분할 ──
function layout14(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 오른쪽 위→왼쪽 아래 대각선
  ctx.beginPath();ctx.moveTo(W*0.5,0);ctx.lineTo(W,0);ctx.lineTo(W,H);ctx.lineTo(W*0.25,H);ctx.closePath()
  const gd=ctx.createLinearGradient(W*0.5,0,W,H); gd.addColorStop(0,theme.badge+'DD'); gd.addColorStop(1,theme.bg2+'DD')
  ctx.fillStyle=gd; ctx.fill()
  // 왼쪽 내용
  const lx=60; let y=70; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.accent+99
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx,y); y+=24
  ctx.font=`bold 40px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W*0.46).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=52}); y+=8
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx,y)}
  // 오른쪽 포인트
  const rpts=(data.points||[]).slice(0,2); const rx=W*0.58
  rpts.forEach((pt,i)=>{
    const ry=120+i*140; ctx.font=`11px ${font}`; ctx.fillStyle='#FFFFFF88'; ctx.fillText(pt.label,rx,ry)
    ctx.font=`bold 24px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.fillText(pt.value.slice(0,10),rx,ry+22)
  })
  ctx.font=`11px ${font}`;ctx.fillStyle='#333';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',lx,H-20)
}

// ── Layout 15: 점 행렬 배경 ──
function layout15(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 점 행렬
  for(let r=0;r<H;r+=30) for(let c=0;c<W;c+=30){
    ctx.beginPath();ctx.arc(c,r,1.5,0,Math.PI*2);ctx.fillStyle=theme.accent+'22';ctx.fill()
  }
  // 중앙 강조 영역
  const cx=W/2, cy=H/2, rw=540, rh=360
  ctx.fillStyle=theme.bg2+'EE'; ctx.beginPath(); ctx.roundRect(cx-rw/2,cy-rh/2,rw,rh,16); ctx.fill()
  ctx.strokeStyle=theme.accent+'66'; ctx.lineWidth=2; ctx.stroke()
  ctx.textAlign='center'; let y=cy-rh/2+40; ctx.textBaseline='top'
  ctx.font=`bold 12px ${font}`; ctx.fillStyle=theme.badge; ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),cx,y); y+=28
  ctx.font=`bold 36px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,rw-80).slice(0,3).forEach(l=>{ctx.fillText(l,cx,y);y+=46}); y+=6
  if(data.subtitle){ctx.font=`16px ${font}`;ctx.fillStyle=theme.accent+'AA';ctx.fillText(data.subtitle,cx,y)}
  ctx.font=`10px ${font}`;ctx.fillStyle='#444';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',cx,cy+rh/2-14)
}

// ── Layout 16: 뉴스 헤드라인 스타일 ──
function layout16(ctx, W, H, theme, font, data) {
  ctx.fillStyle='#0A0A0A'; ctx.fillRect(0,0,W,H)
  ctx.fillStyle=theme.badge; ctx.fillRect(0,0,W,55)
  // 헤더 바
  ctx.font=`bold 14px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.textAlign='left'; ctx.textBaseline='middle'
  ctx.fillText('● BREAKING', 30, 27)
  ctx.fillText(data.siteName||'SEO WRITER', W/2-60, 27)
  ctx.textAlign='right'; ctx.fillText(new Date().toLocaleDateString('ko-KR'),W-30,27)
  // 메인 제목
  const lx=40; let y=90; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 48px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-lx*2).slice(0,2).forEach(l=>{ctx.fillText(l,lx,y);y+=60}); y+=6
  // 수평선
  ctx.beginPath();ctx.moveTo(lx,y);ctx.lineTo(W-lx,y);ctx.strokeStyle=theme.badge;ctx.lineWidth=3;ctx.stroke(); y+=18
  if(data.subtitle){ctx.font=`22px ${font}`;ctx.fillStyle='#AAAAAA';ctx.fillText(data.subtitle,lx,y);y+=32}
  // 포인트 칩
  const pts=(data.points||[]).slice(0,3)
  pts.forEach((pt,i)=>{
    ctx.beginPath();ctx.roundRect(lx+i*200,y,180,50,6);ctx.fillStyle='#1a1a1a';ctx.fill()
    ctx.strokeStyle=theme.badge+'66';ctx.lineWidth=1;ctx.stroke()
    ctx.font=`10px ${font}`;ctx.fillStyle='#666';ctx.fillText(pt.label,lx+i*200+12,y+10)
    ctx.font=`bold 16px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,10),lx+i*200+12,y+26)
  })
}

// ── Layout 17: 타임라인 스타일 ──
function layout17(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 세로 타임라인 바
  const tlX=100
  ctx.beginPath();ctx.moveTo(tlX,40);ctx.lineTo(tlX,H-40);ctx.strokeStyle=theme.accent+'44';ctx.lineWidth=3;ctx.stroke()
  // 타임라인 포인트들
  const pts=(data.points||[]).slice(0,3)
  pts.forEach((pt,i)=>{
    const py=130+i*150
    ctx.beginPath();ctx.arc(tlX,py,12,0,Math.PI*2);ctx.fillStyle=theme.badge;ctx.fill()
    ctx.font=`11px ${font}`;ctx.fillStyle='#888';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(pt.label,tlX+30,py-10)
    ctx.font=`bold 20px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,14),tlX+30,py+8)
  })
  // 우측 제목 영역
  const rx=W*0.45; let y=60; ctx.textAlign='right'; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),W-50,y); y+=28
  ctx.font=`bold 36px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-rx-60).forEach(l=>{ctx.fillText(l,W-50,y);y+=46}); y+=8
  if(data.subtitle){ctx.font=`16px ${font}`;ctx.fillStyle='#777';ctx.fillText(data.subtitle,W-50,y)}
}

// ── Layout 18: 우하단 강조 패널 ──
function layout18(ctx, W, H, theme, font, data) {
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,theme.bg2); g.addColorStop(1,theme.bg1)
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
  // 우하단 색상 패널
  ctx.beginPath();ctx.moveTo(W*0.5,H);ctx.lineTo(W,H*0.4);ctx.lineTo(W,H);ctx.closePath()
  ctx.fillStyle=theme.badge+'CC'; ctx.fill()
  // 방사선 장식
  const ox=W*0.95, oy=H*0.5
  for(let a=0;a<Math.PI*2;a+=Math.PI/8){
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox+Math.cos(a)*250,oy+Math.sin(a)*250)
    ctx.strokeStyle=theme.accent+'15';ctx.lineWidth=1;ctx.stroke()
  }
  // 좌상단 내용
  const lx=60; let y=70; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 12px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx,y); y+=30
  ctx.font=`bold 44px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W*0.54).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=56}); y+=8
  if(data.subtitle){ctx.font=`19px ${font}`;ctx.fillStyle='#999';ctx.fillText(data.subtitle,lx,y)}
  ctx.font=`11px ${font}`;ctx.fillStyle='#FFFFFF66';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',W*0.72,H-20)
}

// ── Layout 19: 상단 줄무늬 패턴 ──
function layout19(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 상단 줄무늬 영역
  ctx.fillStyle=theme.bg2; ctx.fillRect(0,0,W,200)
  for(let i=0;i<W;i+=40){
    ctx.fillStyle=theme.accent+(i%80===0?'18':'0C'); ctx.fillRect(i,0,20,200)
  }
  // 오버랩 제목 영역
  ctx.fillStyle=theme.bg1; ctx.beginPath(); ctx.roundRect(40,140,W-80,H-170,12); ctx.fill()
  const lx=80; let y=180; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 12px ${font}`; ctx.fillStyle=theme.badge
  ctx.fillText('■ '+data.category.replace(/-/g,' ').toUpperCase(),lx,y); y+=28
  ctx.font=`bold 38px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-lx*2).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=50}); y+=10
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx,y);y+=28}
  ctx.font=`11px ${font}`;ctx.fillStyle='#444';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',lx,H-20)
}

// ── Layout 20: 원형 중앙 배지 ──
function layout20(ctx, W, H, theme, font, data) {
  const g=ctx.createRadialGradient(W/2,H/2,80,W/2,H/2,W*0.7)
  g.addColorStop(0,theme.bg2); g.addColorStop(1,theme.bg1)
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
  // 방사선
  for(let a=0;a<Math.PI*2;a+=Math.PI/12){
    ctx.beginPath();ctx.moveTo(W/2,H/2);ctx.lineTo(W/2+Math.cos(a)*700,H/2+Math.sin(a)*700)
    ctx.strokeStyle=theme.accent+'11';ctx.lineWidth=1;ctx.stroke()
  }
  // 중앙 배지
  ctx.beginPath();ctx.arc(W/2,H/2,180,0,Math.PI*2);ctx.fillStyle=theme.badge+'CC';ctx.fill()
  ctx.beginPath();ctx.arc(W/2,H/2,180,0,Math.PI*2);ctx.strokeStyle=theme.accent+'66';ctx.lineWidth=3;ctx.stroke()
  ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.font=`bold 12px ${font}`; ctx.fillStyle=theme.accent; ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),W/2,H/2-70)
  ctx.font=`bold 30px ${font}`; ctx.fillStyle='#FFFFFF'
  const tl=wrapCJK(ctx,data.title,300).slice(0,2); const th=tl.length*36
  tl.forEach((l,i)=>{ctx.fillText(l,W/2,H/2-th/2+i*36+18)})
  if(data.subtitle){ctx.font=`14px ${font}`;ctx.fillStyle='#AAAAAA';ctx.fillText(data.subtitle,W/2,H/2+100)}
  ctx.font=`11px ${font}`;ctx.fillStyle='#444';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',W/2,H-20)
}

// ── Layout 21: 좌상단 삼각 컬러 블록 ──
function layout21(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W*0.55,0);ctx.lineTo(0,H*0.75);ctx.closePath()
  const gp=ctx.createLinearGradient(0,0,W*0.55,H*0.75); gp.addColorStop(0,theme.badge); gp.addColorStop(1,theme.bg2)
  ctx.fillStyle=gp; ctx.fill()
  // 장식 원
  ctx.beginPath();ctx.arc(W*0.52,H*0.72,30,0,Math.PI*2);ctx.strokeStyle=theme.accent+'55';ctx.lineWidth=2;ctx.stroke()
  // 내용
  const lx=50; let y=60; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 13px ${font}`; ctx.fillStyle='#FFFFFF99'
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx,y); y+=28
  ctx.font=`bold 42px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W*0.45-lx).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=54}); y+=8
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#FFFFFF88';ctx.fillText(data.subtitle,lx,y)}
  // 우하단 포인트
  const rx=W*0.6; const pts=(data.points||[]).slice(0,2)
  pts.forEach((pt,i)=>{
    ctx.font=`11px ${font}`;ctx.fillStyle='#555';ctx.fillText(pt.label,rx,H/2+i*100)
    ctx.font=`bold 22px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,12),rx,H/2+i*100+20)
  })
}

// ── Layout 22: 양쪽 날개 바 ──
function layout22(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  ctx.fillStyle=theme.badge; ctx.fillRect(0,0,30,H); ctx.fillRect(W-30,0,30,H)
  // 세로 텍스트
  ctx.save();ctx.translate(15,H/2);ctx.rotate(-Math.PI/2)
  ctx.font=`bold 11px ${font}`;ctx.fillStyle=theme.accent+'AA';ctx.textAlign='center';ctx.textBaseline='middle'
  ctx.fillText(data.siteName||'SEO WRITER',0,0); ctx.restore()
  ctx.save();ctx.translate(W-15,H/2);ctx.rotate(Math.PI/2)
  ctx.font=`bold 11px ${font}`;ctx.fillStyle=theme.accent+'AA';ctx.textAlign='center';ctx.textBaseline='middle'
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),0,0); ctx.restore()
  // 중앙 내용
  ctx.textAlign='center'; let y=80; ctx.textBaseline='top'
  ctx.font=`bold 12px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText('[ '+data.category.replace(/-/g,' ').toUpperCase()+' ]',W/2,y); y+=30
  ctx.font=`bold 40px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-160).slice(0,3).forEach(l=>{ctx.fillText(l,W/2,y);y+=52}); y+=8
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,W/2,y);y+=28}
  // 하단 수평 포인트
  const pts=(data.points||[]).slice(0,3); const cw=(W-160)/pts.length
  pts.forEach((pt,i)=>{
    ctx.font=`10px ${font}`;ctx.fillStyle='#555';ctx.fillText(pt.label,60+i*cw+cw/2,y)
    ctx.font=`bold 16px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,10),60+i*cw+cw/2,y+16)
  })
}

// ── Layout 23: 이중 테두리 프레임 ──
function layout23(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg2; ctx.fillRect(0,0,W,H)
  ctx.strokeStyle=theme.accent+'55'; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(18,18,W-36,H-36,10); ctx.stroke()
  ctx.strokeStyle=theme.accent+'22'; ctx.lineWidth=8; ctx.beginPath(); ctx.roundRect(32,32,W-64,H-64,8); ctx.stroke()
  // 코너 사각형 장식
  [[30,30],[W-30,30],[30,H-30],[W-30,H-30]].forEach(([x,y])=>{
    ctx.fillStyle=theme.badge; ctx.fillRect(x-8,y-8,16,16)
  })
  ctx.textAlign='center'; let y=100; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText('✦ '+data.category.replace(/-/g,' ').toUpperCase()+' ✦',W/2,y); y+=28
  ctx.font=`bold 40px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-200).slice(0,3).forEach(l=>{ctx.fillText(l,W/2,y);y+=52}); y+=8
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,W/2,y);y+=28}
  ctx.font=`11px ${font}`;ctx.fillStyle='#444';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',W/2,H-45)
}

// ── Layout 24: 웨이브 분할 ──
function layout24(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 웨이브 상단 영역
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W,0)
  ctx.lineTo(W,H*0.45); ctx.quadraticCurveTo(W*0.75,H*0.55,W*0.5,H*0.45)
  ctx.quadraticCurveTo(W*0.25,H*0.35,0,H*0.45); ctx.closePath()
  ctx.fillStyle=theme.badge; ctx.fill()
  // 상단 내용
  ctx.textAlign='center'; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle='#FFFFFF99'
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),W/2,30)
  ctx.font=`bold 40px ${font}`; ctx.fillStyle='#FFFFFF'; let y=60
  wrapCJK(ctx,data.title,W-140).slice(0,2).forEach(l=>{ctx.fillText(l,W/2,y);y+=52})
  // 하단 내용
  y=H*0.52; ctx.textAlign='left'; ctx.textBaseline='top'; const lx=60
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx,y);y+=28}
  ctx.beginPath();ctx.moveTo(lx,y+10);ctx.lineTo(W-60,y+10);ctx.strokeStyle=theme.accent+'33';ctx.lineWidth=1;ctx.stroke(); y+=26
  const pts=(data.points||[]).slice(0,3); const cw=(W-lx-60)/pts.length
  pts.forEach((pt,i)=>{
    ctx.font=`10px ${font}`;ctx.fillStyle='#555';ctx.fillText(pt.label,lx+i*cw,y)
    ctx.font=`bold 18px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,10),lx+i*cw,y+16)
  })
  ctx.font=`11px ${font}`;ctx.fillStyle='#333';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',lx,H-20)
}

// ── Layout 25: X자 교차 장식 ──
function layout25(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg2; ctx.fillRect(0,0,W,H)
  ctx.strokeStyle=theme.accent+'15'; ctx.lineWidth=1
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,H);ctx.stroke()
  ctx.beginPath();ctx.moveTo(W,0);ctx.lineTo(0,H);ctx.stroke()
  // 중앙 불투명 오버레이
  ctx.fillStyle=theme.bg1+'EE'; ctx.beginPath(); ctx.roundRect(60,60,W-120,H-120,16); ctx.fill()
  ctx.strokeStyle=theme.accent+'44'; ctx.lineWidth=1.5; ctx.stroke()
  // 내용
  const lx=100; let y=90; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx,y); y+=26
  ctx.font=`bold 38px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-lx*2).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=48}); y+=8
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx,y);y+=26}
  ctx.beginPath();ctx.moveTo(lx,y+6);ctx.lineTo(W-lx,y+6);ctx.strokeStyle=theme.accent+'44';ctx.lineWidth=1;ctx.stroke(); y+=20
  const pts=(data.points||[]).slice(0,3); const cw=(W-lx*2)/pts.length
  pts.forEach((pt,i)=>{
    ctx.font=`10px ${font}`;ctx.fillStyle='#555';ctx.fillText(pt.label,lx+i*cw,y)
    ctx.font=`bold 16px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,10),lx+i*cw,y+16)
  })
}

// ── Layout 26: 우측 세로 정보 컬럼 ──
function layout26(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 우측 세로 컬럼
  ctx.fillStyle=theme.bg2; ctx.fillRect(W-240,0,240,H)
  ctx.fillStyle=theme.badge; ctx.fillRect(W-240,0,4,H)
  // 좌측 메인 내용
  const lx=60; let y=70; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx,y); y+=28
  ctx.font=`bold 44px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-280-lx).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=56}); y+=12
  if(data.subtitle){ctx.font=`20px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx,y)}
  // 우측 세로 포인트
  const rx=W-220; const pts=(data.points||[]).slice(0,3)
  pts.forEach((pt,i)=>{
    const ry=80+i*165
    ctx.font=`10px ${font}`;ctx.fillStyle='#666';ctx.fillText(pt.label.slice(0,8),rx,ry)
    ctx.font=`bold 20px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,8),rx,ry+22)
    if(i<pts.length-1){ctx.beginPath();ctx.moveTo(rx,ry+58);ctx.lineTo(rx+160,ry+58);ctx.strokeStyle='#FFFFFF11';ctx.lineWidth=1;ctx.stroke()}
  })
  ctx.font=`10px ${font}`;ctx.fillStyle='#333';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',rx,H-20)
}

// ── Layout 27: 대형 숫자 배경 ──
function layout27(ctx, W, H, theme, font, data) {
  ctx.fillStyle=theme.bg1; ctx.fillRect(0,0,W,H)
  // 대형 배경 숫자
  const nums=['01','02','03','04','05']
  const bgNum=nums[Math.floor(Math.random()*nums.length)]
  ctx.font=`bold 280px ${font}`; ctx.fillStyle=theme.accent+'0D'; ctx.textAlign='right'; ctx.textBaseline='bottom'
  ctx.fillText(bgNum, W-20, H+20)
  // 상단 색상 바
  const g=ctx.createLinearGradient(0,0,W,0); g.addColorStop(0,theme.badge); g.addColorStop(1,theme.badge+'00')
  ctx.fillStyle=g; ctx.fillRect(0,0,W,10)
  const lx=60; let y=50; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.accent
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx,y); y+=28
  ctx.font=`bold 46px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W*0.7).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=58}); y+=10
  if(data.subtitle){ctx.font=`20px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx,y);y+=30}
  ctx.font=`11px ${font}`;ctx.fillStyle='#333';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',lx,H-20)
}

// ── Layout 28: 리본 상단 배너 ──
function layout28(ctx, W, H, theme, font, data) {
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,theme.bg2); g.addColorStop(1,theme.bg1)
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
  // 리본 배너
  ctx.fillStyle=theme.badge; ctx.fillRect(0,0,W,80)
  ctx.beginPath(); ctx.moveTo(0,80); ctx.lineTo(60,110); ctx.lineTo(0,110); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(W,80); ctx.lineTo(W-60,110); ctx.lineTo(W,110); ctx.closePath(); ctx.fill()
  ctx.font=`bold 16px ${font}`; ctx.fillStyle='#FFFFFF'; ctx.textAlign='center'; ctx.textBaseline='middle'
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(), W/2, 40)
  // 내용
  const lx=70; let y=130; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 40px ${font}`; ctx.fillStyle='#FFFFFF'
  wrapCJK(ctx,data.title,W-lx*2).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=52}); y+=10
  if(data.subtitle){ctx.font=`18px ${font}`;ctx.fillStyle='#888';ctx.fillText(data.subtitle,lx,y);y+=28}
  ctx.beginPath();ctx.moveTo(lx,y+8);ctx.lineTo(W-lx,y+8);ctx.strokeStyle=theme.accent+'33';ctx.lineWidth=1;ctx.stroke(); y+=24
  const pts=(data.points||[]).slice(0,3); const cw=(W-lx*2)/pts.length
  pts.forEach((pt,i)=>{
    ctx.font=`10px ${font}`;ctx.fillStyle='#555';ctx.fillText(pt.label,lx+i*cw,y)
    ctx.font=`bold 16px ${font}`;ctx.fillStyle=theme.accent;ctx.fillText(pt.value.slice(0,10),lx+i*cw,y+16)
  })
  ctx.font=`11px ${font}`;ctx.fillStyle='#333';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer',lx,H-20)
}

// ── Layout 29: 클립보드 스타일 ──
function layout29(ctx, W, H, theme, font, data) {
  ctx.fillStyle='#181818'; ctx.fillRect(0,0,W,H)
  // 클립보드 패드
  ctx.fillStyle='#F5F5F0'; ctx.beginPath(); ctx.roundRect(60, 80, W-120, H-120, 8); ctx.fill()
  // 클립 바
  ctx.fillStyle=theme.badge; ctx.beginPath(); ctx.roundRect(W/2-80,50,160,60,8); ctx.fill()
  ctx.fillStyle='#ccc'; ctx.beginPath(); ctx.roundRect(W/2-40,45,80,40,4); ctx.fill()
  // 선 장식 (노트 줄)
  for(let i=0;i<7;i++){const ly=200+i*48;ctx.beginPath();ctx.moveTo(80,ly);ctx.lineTo(W-80,ly);ctx.strokeStyle='#E0E0E0';ctx.lineWidth=1;ctx.stroke()}
  // 내용 (다크 텍스트)
  const lx=90; let y=115; ctx.textAlign='left'; ctx.textBaseline='top'
  ctx.font=`bold 11px ${font}`; ctx.fillStyle=theme.badge
  ctx.fillText(data.category.replace(/-/g,' ').toUpperCase(),lx,y); y+=24
  ctx.font=`bold 32px ${font}`; ctx.fillStyle='#222'
  wrapCJK(ctx,data.title,W-lx*2-40).slice(0,3).forEach(l=>{ctx.fillText(l,lx,y);y+=42}); y+=8
  if(data.subtitle){ctx.font=`16px ${font}`;ctx.fillStyle='#666';ctx.fillText(data.subtitle,lx,y);y+=24}
  ctx.font=`11px ${font}`;ctx.fillStyle='#999';ctx.textBaseline='bottom';ctx.fillText(data.siteName||'seo-writer', W-80, H-40);ctx.textAlign='right'
}

// ── Layout 30: 내추럴/보태니컬 (크림 배경 + 식물 일러스트) ──
function layout30(ctx, W, H, theme, font, data) {
  // 크림 베이지 배경
  ctx.fillStyle = '#F5EFE6'; ctx.fillRect(0, 0, W, H)
  // 상단 테두리 안쪽 카드 효과
  ctx.fillStyle = '#FAF6F0'; ctx.beginPath(); ctx.roundRect(16,16,W-32,H-32,8); ctx.fill()
  ctx.strokeStyle = '#D4B896'; ctx.lineWidth = 1.5; ctx.stroke()
  // 좌상단: 올리브 가지 (초록 원/타원들)
  const drawLeaf = (x,y,r,angle,c) => {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle)
    ctx.beginPath(); ctx.ellipse(0,0,r,r*0.45,0,0,Math.PI*2)
    ctx.fillStyle=c; ctx.fill(); ctx.restore()
  }
  const drawCircle = (x,y,r,c) => {ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=c;ctx.fill()}
  // 올리브 나뭇가지 (좌상단)
  ctx.strokeStyle='#8B7355'; ctx.lineWidth=2
  ctx.beginPath();ctx.moveTo(30,30);ctx.bezierCurveTo(80,40,100,20,140,30);ctx.stroke()
  ctx.beginPath();ctx.moveTo(55,33);ctx.lineTo(45,55);ctx.stroke()
  ctx.beginPath();ctx.moveTo(80,28);ctx.lineTo(70,50);ctx.stroke()
  ctx.beginPath();ctx.moveTo(110,25);ctx.lineTo(100,47);ctx.stroke()
  drawLeaf(45,55,14,0.3,'#6B8E23')
  drawLeaf(70,50,14,-0.4,'#7A9E2E')
  drawLeaf(100,47,14,0.5,'#6B8E23')
  drawLeaf(130,33,14,-0.3,'#7A9E2E')
  // 올리브 열매
  drawCircle(48,42,5,'#8B9845'); drawCircle(73,37,5,'#9BA855'); drawCircle(103,34,5,'#8B9845')
  // 우상단: 러스트/테라코타 코너 블록 + 데이지꽃
  const rtX=W-30, rtY=30
  ctx.fillStyle='#C1704A'; ctx.beginPath(); ctx.arc(W,0,90,0,Math.PI/2); ctx.fill()
  // 데이지 꽃잎들
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4; const px=rtX-30+Math.cos(a)*18, py=rtY+30+Math.sin(a)*18
    ctx.beginPath();ctx.ellipse(px,py,8,5,a,0,Math.PI*2);ctx.fillStyle='#F5F0E8';ctx.fill()
  }
  drawCircle(rtX-30,rtY+30,9,'#F5C842')
  // 우하단: 은행잎 (부채꼴)
  for(let i=0;i<5;i++){
    const a=(i-2)*0.2; ctx.save(); ctx.translate(W-45+i*8,H-35)
    ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0,0)
    ctx.arc(0,0,18,-Math.PI/3+a,Math.PI/3+a); ctx.closePath()
    ctx.fillStyle=`hsl(${88+i*6},45%,${38+i*4}%)`; ctx.fill(); ctx.restore()
  }
  // 좌하단: 데이지 꽃
  const fdx=55, fdy=H-55
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4; const px=fdx+Math.cos(a)*18, py=fdy+Math.sin(a)*18
    ctx.beginPath();ctx.ellipse(px,py,8,5,a,0,Math.PI*2);ctx.fillStyle='#F0EAE0';ctx.fill()
  }
  drawCircle(fdx,fdy,9,'#F5C842')
  // 제목 텍스트 (중앙)
  ctx.textAlign='center'; ctx.textBaseline='middle'
  const titleLines = wrapCJK(ctx, data.captions[0]||data.title, W-120).slice(0,3)
  const lineH = 60, totalH = titleLines.length * lineH
  ctx.font=`bold 54px ${font}`; ctx.fillStyle='#6B4226'
  ctx.shadowColor='rgba(107,66,38,0.2)'; ctx.shadowBlur=8
  titleLines.forEach((l,i)=>ctx.fillText(l, W/2, H/2 - totalH/2 + lineH*i + lineH/2))
  ctx.shadowBlur=0
  // 사이트명
  ctx.font=`12px ${font}`; ctx.fillStyle='#AAA'; ctx.textBaseline='bottom'
  ctx.fillText(data.siteName||'', W/2, H-22)
}

// ── Layout 31: 프리미엄 골드 (블랙+금색 럭셔리) ──
function layout31(ctx, W, H, theme, font, data) {
  // 배경 그라데이션 (어두운 차콜)
  const bg = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.8)
  bg.addColorStop(0,'#2A2A2A'); bg.addColorStop(1,'#0A0A0A')
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)
  // 황금 외곽선 (테두리)
  const drawGoldBorder = (x,y,w,h,r,lw,alpha=1) => {
    const g=ctx.createLinearGradient(x,y,x+w,y+h)
    g.addColorStop(0,`rgba(212,175,55,${alpha})`)
    g.addColorStop(0.5,`rgba(255,223,0,${alpha})`)
    g.addColorStop(1,`rgba(184,142,28,${alpha})`)
    ctx.strokeStyle=g; ctx.lineWidth=lw
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.stroke()
  }
  drawGoldBorder(8,8,W-16,H-16,4,8)
  drawGoldBorder(18,18,W-36,H-36,3,2)
  drawGoldBorder(24,24,W-48,H-48,2,1)
  // 코너 다이아몬드 장식
  const diamond = (x,y,s,color) => {
    ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4)
    ctx.fillStyle=color; ctx.fillRect(-s,-s,s*2,s*2)
    ctx.restore()
  }
  const gold='#D4AF37'
  diamond(20,20,5,gold); diamond(W-20,20,5,gold)
  diamond(20,H-20,5,gold); diamond(W-20,H-20,5,gold)
  // 상단 중앙 장식 (왕관형 장식)
  ctx.strokeStyle=gold; ctx.lineWidth=1.5
  ctx.beginPath(); ctx.moveTo(W/2-60,40); ctx.lineTo(W/2-40,55); ctx.lineTo(W/2-20,40)
  ctx.lineTo(W/2,50); ctx.lineTo(W/2+20,40); ctx.lineTo(W/2+40,55)
  ctx.lineTo(W/2+60,40); ctx.stroke()
  [W/2-40,W/2,W/2+40].forEach(x=>{
    ctx.beginPath();ctx.arc(x,38,3,0,Math.PI*2);ctx.fillStyle=gold;ctx.fill()
  })
  // 하단 장식 라인
  ctx.beginPath(); ctx.moveTo(W/2-70,H-40); ctx.lineTo(W/2+70,H-40)
  ctx.strokeStyle=gold; ctx.lineWidth=1; ctx.stroke()
  // 엠블럼 원 (하단 중앙)
  ctx.beginPath();ctx.arc(W/2,H-40,12,0,Math.PI*2)
  const eg=ctx.createRadialGradient(W/2,H-40,0,W/2,H-40,12)
  eg.addColorStop(0,'#FFD700'); eg.addColorStop(1,'#8B6914')
  ctx.strokeStyle=gold; ctx.lineWidth=2; ctx.stroke()
  // 중앙 제목
  ctx.textAlign='center'; ctx.textBaseline='middle'
  const tLines=wrapCJK(ctx,data.captions[0]||data.title,W-100).slice(0,3)
  const lh=58, th=tLines.length*lh
  const gg=ctx.createLinearGradient(0,H/2-th/2,0,H/2+th/2)
  gg.addColorStop(0,'#FFD700'); gg.addColorStop(0.5,'#FFF8DC'); gg.addColorStop(1,'#B8860B')
  ctx.font=`bold 52px ${font}`
  // 텍스트 그림자 (금색 글로우)
  ctx.shadowColor='rgba(212,175,55,0.6)'; ctx.shadowBlur=20
  tLines.forEach((l,i)=>{
    ctx.fillStyle=gg; ctx.fillText(l,W/2,H/2-th/2+lh*i+lh/2)
  })
  ctx.shadowBlur=0
  ctx.font=`10px ${font}`; ctx.fillStyle='rgba(212,175,55,0.5)'
  ctx.fillText(data.siteName||'PREMIUM',W/2,H-40)
}

// ── Layout 32: 실크 럭셔리 (버건디+골드 물결) ──
function layout32(ctx, W, H, theme, font, data) {
  // 와인/버건디 배경
  const bg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W)
  bg.addColorStop(0,'#6B1A2E'); bg.addColorStop(1,'#2D0A14')
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)
  // 금색 물결 대각선 리본 (베지어 곡선)
  const drawRibbon = (startX,startY,cp1x,cp1y,cp2x,cp2y,ex,ey,lw,alpha) => {
    const g=ctx.createLinearGradient(startX,startY,ex,ey)
    g.addColorStop(0,`rgba(180,140,20,${alpha})`)
    g.addColorStop(0.4,`rgba(255,215,0,${alpha})`)
    g.addColorStop(0.6,`rgba(255,235,100,${alpha})`)
    g.addColorStop(1,`rgba(140,100,10,${alpha})`)
    ctx.strokeStyle=g; ctx.lineWidth=lw; ctx.lineCap='round'
    ctx.beginPath(); ctx.moveTo(startX,startY)
    ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,ex,ey); ctx.stroke()
  }
  // 굵은 금색 리본들
  drawRibbon(-20,-20,100,80,200,100,W+20,W*0.3,28,0.85)
  drawRibbon(-20,W*0.1,80,120,160,180,W*0.7,W+20,22,0.75)
  drawRibbon(W*0.3,-30,W*0.5,80,W*0.7,150,W+30,H*0.6,18,0.7)
  // 광택 효과 (글로우)
  ctx.shadowColor='rgba(255,215,0,0.4)'; ctx.shadowBlur=15
  drawRibbon(10,-10,120,70,210,120,W+10,W*0.28,6,1)
  ctx.shadowBlur=0
  // 중앙 장식 프레임
  const fx=W/2, fy=H/2, fw=230, fh=160
  ctx.strokeStyle='rgba(212,175,55,0.8)'; ctx.lineWidth=2
  // 육각 느낌의 배지 프레임
  ctx.beginPath()
  ctx.moveTo(fx-fw/2+20,fy-fh/2)
  ctx.lineTo(fx+fw/2-20,fy-fh/2)
  ctx.lineTo(fx+fw/2,fy-fh/2+20)
  ctx.lineTo(fx+fw/2,fy+fh/2-20)
  ctx.lineTo(fx+fw/2-20,fy+fh/2)
  ctx.lineTo(fx-fw/2+20,fy+fh/2)
  ctx.lineTo(fx-fw/2,fy+fh/2-20)
  ctx.lineTo(fx-fw/2,fy-fh/2+20)
  ctx.closePath()
  ctx.strokeStyle='rgba(212,175,55,0.9)'; ctx.stroke()
  ctx.fillStyle='rgba(60,0,20,0.5)'; ctx.fill()
  // 코너 잎사귀 (라인아트)
  const leaf = (x,y,size) => {
    ctx.strokeStyle='rgba(180,140,20,0.5)'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(x,y); ctx.bezierCurveTo(x+size,y-size/2,x+size,y+size/2,x,y+size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+size); ctx.stroke()
  }
  leaf(28,28,20); leaf(W-48,28,20); leaf(28,H-48,-20); leaf(W-48,H-48,-20)
  // 제목 텍스트
  ctx.textAlign='center'; ctx.textBaseline='middle'
  const tLines=wrapCJK(ctx,data.captions[0]||data.title,fw-30).slice(0,3)
  const lh=52, th=tLines.length*lh
  ctx.font=`bold 46px ${font}`
  const tg=ctx.createLinearGradient(0,fy-th/2,0,fy+th/2)
  tg.addColorStop(0,'#FFD700'); tg.addColorStop(0.5,'#FFF8DC'); tg.addColorStop(1,'#D4AF37')
  ctx.shadowColor='rgba(255,215,0,0.5)'; ctx.shadowBlur=12
  tLines.forEach((l,i)=>{ctx.fillStyle=tg; ctx.fillText(l,fx,fy-th/2+lh*i+lh/2)})
  ctx.shadowBlur=0
  ctx.font=`11px ${font}`; ctx.fillStyle='rgba(212,175,55,0.45)'; ctx.textBaseline='bottom'
  ctx.fillText(data.siteName||'',W/2,H-20)
}

// ── Layout 33: 로즈 미니멀 (소프트 핑크 + 장미) ──
function layout33(ctx, W, H, theme, font, data) {
  // 소프트 핑크 그라데이션 배경
  const bg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.75)
  bg.addColorStop(0,'#FEF0F0'); bg.addColorStop(0.5,'#FDE4E4'); bg.addColorStop(1,'#F5D0D0')
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)

  // 장미 아웃라인 (코너 4곳 - 간단한 곡선 꽃)
  const drawRoseOutline = (cx,cy,r,alpha) => {
    ctx.strokeStyle=`rgba(180,120,120,${alpha})`; ctx.lineWidth=1.5
    for(let p=0;p<5;p++){
      const a=p*Math.PI*2/5 - Math.PI/2
      ctx.beginPath()
      ctx.arc(cx+Math.cos(a)*r*0.5,cy+Math.sin(a)*r*0.5,r*0.55,0,Math.PI*2)
      ctx.stroke()
    }
    ctx.beginPath(); ctx.arc(cx,cy,r*0.3,0,Math.PI*2)
    ctx.strokeStyle=`rgba(160,100,100,${alpha*0.7})`; ctx.stroke()
  }
  // 곡선 줄기/넝쿨
  ctx.strokeStyle='rgba(160,130,130,0.3)'; ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(0,50); ctx.bezierCurveTo(80,30,120,80,W,60); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0,H-50); ctx.bezierCurveTo(80,H-30,120,H-80,W,H-60); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(30,0); ctx.bezierCurveTo(20,80,80,120,40,H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W-30,0); ctx.bezierCurveTo(W-20,80,W-80,120,W-40,H); ctx.stroke()
  // 코너 장미들
  drawRoseOutline(45,45,32,0.4); drawRoseOutline(W-45,45,32,0.4)
  drawRoseOutline(45,H-45,32,0.35); drawRoseOutline(W-45,H-45,32,0.35)
  // 큰 배경 장미 (배경에 연하게)
  drawRoseOutline(W*0.15,H*0.75,60,0.15); drawRoseOutline(W*0.85,H*0.25,55,0.15)
  // 얇은 사각 테두리
  ctx.strokeStyle='rgba(180,130,130,0.5)'; ctx.lineWidth=1
  ctx.beginPath(); ctx.roundRect(18,18,W-36,H-36,3); ctx.stroke()
  // 상단 장식 라인
  ctx.beginPath(); ctx.moveTo(W/2,55); ctx.lineTo(W/2,75)
  ctx.strokeStyle='rgba(160,110,110,0.6)'; ctx.lineWidth=1.5; ctx.stroke()
  // 제목 텍스트
  ctx.textAlign='center'; ctx.textBaseline='middle'
  const tLines=wrapCJK(ctx,data.captions[0]||data.title,W-120).slice(0,3)
  const lh=58, th=tLines.length*lh
  ctx.font=`bold 50px ${font}`
  const tg=ctx.createLinearGradient(0,H/2-th/2,0,H/2+th/2)
  tg.addColorStop(0,'#8B5E5E'); tg.addColorStop(1,'#7A4A4A')
  ctx.shadowColor='rgba(180,100,100,0.2)'; ctx.shadowBlur=10
  tLines.forEach((l,i)=>{ctx.fillStyle=tg; ctx.fillText(l,W/2,H/2-th/2+lh*i+lh/2)})
  ctx.shadowBlur=0
  // 로고 원 배지 (하단)
  const bx=W/2, by=H-42
  ctx.beginPath(); ctx.arc(bx,by,16,0,Math.PI*2)
  ctx.strokeStyle='rgba(160,110,110,0.6)'; ctx.lineWidth=1.5; ctx.stroke()
  ctx.font=`bold 10px ${font}`; ctx.fillStyle='rgba(140,90,90,0.7)'; ctx.textBaseline='middle'
  ctx.fillText(data.siteName||'',bx,by)
}

// ── Layout 34: 에코/자연 (다크 그린 + 수채화 식물) ──
function layout34(ctx, W, H, theme, font, data) {
  // 다크 포레스트 그린 배경
  const bg=ctx.createLinearGradient(0,0,0,H)
  bg.addColorStop(0,'#2D4A2D'); bg.addColorStop(1,'#1A2E1A')
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)
  // 크림/베이지 내부 유기적 형태 (캔버스 종이 느낌)
  ctx.beginPath()
  ctx.moveTo(50,40)
  ctx.bezierCurveTo(80,20,W-80,15,W-45,45)
  ctx.bezierCurveTo(W-20,80,W-30,H-80,W-50,H-45)
  ctx.bezierCurveTo(W-80,H-20,80,H-15,50,H-50)
  ctx.bezierCurveTo(20,H-80,25,80,50,40)
  ctx.fillStyle='#F5F0E0'; ctx.fill()
  // 수채화 식물 일러스트 - 올리브 가지들
  const drawWaterLeaf=(x,y,size,color,angle)=>{
    ctx.save();ctx.translate(x,y);ctx.rotate(angle)
    ctx.beginPath();ctx.ellipse(0,0,size,size*0.4,0,0,Math.PI*2)
    ctx.fillStyle=color;ctx.globalAlpha=0.85;ctx.fill();ctx.globalAlpha=1;ctx.restore()
  }
  // 상단 올리브 가지들
  ctx.strokeStyle='#5C7A2E'; ctx.lineWidth=2
  ctx.beginPath();ctx.moveTo(60,20);ctx.bezierCurveTo(120,35,180,25,220,40);ctx.stroke()
  ctx.beginPath();ctx.moveTo(W-60,20);ctx.bezierCurveTo(W-120,35,W-180,25,W-220,40);ctx.stroke()
  for(let i=0;i<5;i++){
    drawWaterLeaf(75+i*30,35-i%2*12,14,-0.5+i*0.4,'#6B9E2E')
    drawWaterLeaf(W-75-i*30,35-i%2*12,14,0.5-i*0.4,'#5A8E20')
  }
  // 올리브 열매
  [80,110,140,W-80,W-110,W-140].forEach(x=>{
    ctx.beginPath();ctx.arc(x,28,5,'#7A9E35');ctx.fillStyle='#8B9845';ctx.fill()
  })
  // 하단 식물들
  ctx.strokeStyle='#4A7020'; ctx.lineWidth=1.5
  ctx.beginPath();ctx.moveTo(30,H-20);ctx.bezierCurveTo(50,H-80,80,H-60,100,H-20);ctx.stroke()
  ctx.beginPath();ctx.moveTo(W-30,H-20);ctx.bezierCurveTo(W-50,H-80,W-80,H-60,W-100,H-20);ctx.stroke()
  for(let i=0;i<4;i++){
    drawWaterLeaf(35+i*20,H-50+i%2*10,16,(-1+i*0.5),'#5A8E20')
    drawWaterLeaf(W-35-i*20,H-50+i%2*10,16,(1-i*0.5),'#6B9E2E')
  }
  // 에코 배지 (우하단)
  const bx=W-50,by=H-50
  ctx.beginPath();ctx.arc(bx,by,26,0,Math.PI*2);ctx.fillStyle='#3D6B20';ctx.fill()
  ctx.strokeStyle='#6B9E2E';ctx.lineWidth=1.5;ctx.stroke()
  // 제목 텍스트
  ctx.textAlign='center'; ctx.textBaseline='middle'
  const tLines=wrapCJK(ctx,data.captions[0]||data.title,W-140).slice(0,3)
  const lh=56,th=tLines.length*lh
  ctx.font=`bold 48px ${font}`; ctx.fillStyle='#4A2E10'
  ctx.shadowColor='rgba(70,50,20,0.25)'; ctx.shadowBlur=8
  tLines.forEach((l,i)=>ctx.fillText(l,W/2,H/2-th/2+lh*i+lh/2))
  ctx.shadowBlur=0
  ctx.font=`10px ${font}`; ctx.fillStyle='rgba(80,50,20,0.6)'; ctx.textBaseline='bottom'
  ctx.fillText('SUSTAINABLE BEAUTY',W-50,H-26); ctx.textAlign='right'
  ctx.font=`8px ${font}`; ctx.fillText(data.siteName||'',W-30,H-16)
}

// ── Layout 35: 스포츠/다이나믹 (다크 블루 + 네온) ──
function layout35(ctx, W, H, theme, font, data) {
  // 매우 어두운 네이비 배경
  const bg=ctx.createLinearGradient(0,0,W,H)
  bg.addColorStop(0,'#03071E'); bg.addColorStop(1,'#050A30')
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)
  // 대각선 네온 라인들 (파란색)
  const nLines=[
    {x1:-50,y1:H*0.8,x2:W*0.9,y2:H*0.1,c:'#00B4FF'},
    {x1:-30,y1:H,x2:W*0.75,y2:H*0.15,c:'#0090DD'},
    {x1:-10,y1:H*0.95,x2:W*0.6,y2:H*0.2,c:'#0070BB'},
  ]
  nLines.forEach(({x1,y1,x2,y2,c})=>{
    ctx.shadowColor=c; ctx.shadowBlur=12
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2)
    ctx.strokeStyle=c; ctx.lineWidth=2; ctx.stroke()
  })
  // 화살표 (오렌지 네온)
  const drawNeonArrow=(x,y,size)=>{
    ctx.shadowColor='#FF6B00'; ctx.shadowBlur=20
    ctx.strokeStyle='#FF8C00'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round'
    ctx.beginPath()
    ctx.moveTo(x,y); ctx.lineTo(x+size,y-size*0.5); ctx.lineTo(x+size*1.6,y+size*0.1)
    ctx.moveTo(x+size,y-size*0.5); ctx.lineTo(x+size*0.8,y+size*0.4)
    ctx.stroke()
  }
  drawNeonArrow(W*0.2,H*0.65,70)
  drawNeonArrow(W*0.3,H*0.55,60)
  ctx.shadowBlur=0
  // 인물 실루엣 (단순 러너 형태)
  const drawRunner=(x,y,scale,alpha)=>{
    ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale)
    ctx.fillStyle=`rgba(30,100,200,${alpha})`
    // 몸통
    ctx.beginPath(); ctx.ellipse(0,-20,8,14,0.3,0,Math.PI*2); ctx.fill()
    // 머리
    ctx.beginPath(); ctx.arc(8,-40,8,0,Math.PI*2); ctx.fill()
    // 다리 앞뒤
    ctx.strokeStyle=`rgba(30,100,200,${alpha})`; ctx.lineWidth=5; ctx.lineCap='round'
    ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(-10,15); ctx.lineTo(-5,35); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(12,12); ctx.lineTo(8,35); ctx.stroke()
    // 팔
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(-14,-8); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(16,-5); ctx.stroke()
    ctx.restore()
  }
  drawRunner(W*0.15,H*0.7,1.3,0.6)
  drawRunner(W*0.78,H*0.65,1.3,0.5)
  // 원형 배지 (우상단)
  const cx2=W-70,cy2=70,cr=38
  const cg=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,cr)
  cg.addColorStop(0,'#1A4A8A'); cg.addColorStop(1,'#0A1E4A')
  ctx.beginPath(); ctx.arc(cx2,cy2,cr,0,Math.PI*2)
  ctx.fillStyle=cg; ctx.fill()
  ctx.strokeStyle='#00B4FF'; ctx.lineWidth=2; ctx.shadowColor='#00B4FF'; ctx.shadowBlur=10; ctx.stroke()
  ctx.shadowBlur=0
  // 제목 (상단 큰 텍스트)
  ctx.textAlign='left'; ctx.textBaseline='top'
  const tLines=wrapCJK(ctx,data.captions[0]||data.title,W-80).slice(0,2)
  ctx.font=`bold 62px ${font}`; ctx.fillStyle='#FFFFFF'
  ctx.shadowColor='rgba(0,180,255,0.4)'; ctx.shadowBlur=15
  tLines.forEach((l,i)=>ctx.fillText(l,28,20+i*70))
  ctx.shadowBlur=0
  ctx.font=`11px ${font}`; ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.textBaseline='bottom'
  ctx.fillText(data.siteName||'',30,H-20)
}

// ── Layout 36: 포레스트 배경 (깊은 초록 + 빛 효과) ──
function layout36(ctx, W, H, theme, font, data) {
  // 딥 그린 배경
  ctx.fillStyle='#0D2410'; ctx.fillRect(0,0,W,H)
  // 광선 효과 (중앙 위에서 아래로)
  const rays=[
    {a:-0.3,alpha:0.12},{a:-0.1,alpha:0.18},{a:0.0,alpha:0.22},
    {a:0.1,alpha:0.18},{a:0.3,alpha:0.12},{a:0.5,alpha:0.08}
  ]
  rays.forEach(({a,alpha})=>{
    const rx=W/2+a*W, ry=0
    const g=ctx.createRadialGradient(rx,ry,0,rx,ry,H*1.4)
    g.addColorStop(0,`rgba(180,220,100,${alpha})`)
    g.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=g
    ctx.beginPath(); ctx.moveTo(rx-30,0); ctx.lineTo(rx+30,0)
    ctx.lineTo(rx+W*0.5,H); ctx.lineTo(rx-W*0.5,H); ctx.closePath()
    ctx.fill()
  })
  // 다크 그린 레이어들 (잎사귀 프레임)
  const drawFernLeaf=(x,y,len,angle,color)=>{
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle)
    ctx.strokeStyle=color; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-len); ctx.stroke()
    for(let i=1;i<8;i++){
      const ly=-len*i/8
      ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(len*0.3*(1-i/8),ly-10); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(-len*0.3*(1-i/8),ly-10); ctx.stroke()
    }
    ctx.restore()
  }
  // 테두리 식물들
  const greens=['#1A4A1A','#1F5C1F','#2A6E2A','#356E35','#3D7A3D']
  for(let i=0;i<8;i++){
    drawFernLeaf(i*W/7,H,55+i%3*10,-Math.PI*0.1+i*0.05,greens[i%5])
    drawFernLeaf(i*W/7+20,0,45+i%3*8,Math.PI+0.1-i*0.03,greens[(i+2)%5])
  }
  // 좌우 식물 줄기
  ctx.strokeStyle='#2A5A1A'; ctx.lineWidth=8; ctx.lineCap='round'
  ctx.beginPath(); ctx.moveTo(0,H); ctx.bezierCurveTo(40,H-100,10,H-200,50,H-300); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W,H); ctx.bezierCurveTo(W-40,H-100,W-10,H-200,W-50,H-300); ctx.stroke()
  // 타원형 고엽 장식
  const drawOval=(x,y,rx,ry,angle,c)=>{
    ctx.save();ctx.translate(x,y);ctx.rotate(angle)
    ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2)
    ctx.fillStyle=c;ctx.fill();ctx.restore()
  }
  const leafColors=['#1F6B1F','#256E25','#2A7A2A','#306830','#387038']
  [[25,H-60],[50,H-120],[15,H-180],[W-25,H-60],[W-50,H-120],[W-15,H-180]].forEach(([x,y],i)=>{
    drawOval(x,y,18,9,i*0.4,leafColors[i%5])
  })
  // 제목 (중앙 아래쪽)
  ctx.textAlign='center'; ctx.textBaseline='middle'
  const tLines=wrapCJK(ctx,data.captions[0]||data.title,W-80).slice(0,2)
  const lh=56, th=tLines.length*lh
  ctx.font=`bold 52px ${font}`
  const tg=ctx.createLinearGradient(0,H*0.45,0,H*0.7)
  tg.addColorStop(0,'#F5EAC8'); tg.addColorStop(1,'#E8D5A0')
  ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=20
  tLines.forEach((l,i)=>{
    ctx.fillStyle=tg; ctx.fillText(l,W/2,H*0.55-th/2+lh*i+lh/2)
  })
  ctx.shadowBlur=0
  // 영어 부제목
  if(data.captions[1]){
    ctx.font=`16px ${font}`; ctx.fillStyle='rgba(220,200,160,0.8)'
    ctx.fillText(data.captions[1],W/2,H*0.55+th/2+20)
  }
  ctx.font=`11px ${font}`; ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.textBaseline='bottom'
  ctx.fillText(data.siteName||'',W/2,H-18)
}

async function generateCard(data) {
  ensureFonts()
  const W = 500, H = 500
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const theme = resolveTheme(data)
  const font = getFont(data.language)
  const layout = Number(data.layout ?? 0) % 37

  console.log(`🎨 layout=${layout}, variant=${data.variant}, category=${data.category}`)

  const L = [layout0,layout1,layout2,layout3,layout4,layout5,layout6,layout7,layout8,layout9,
    layout10,layout11,layout12,layout13,layout14,layout15,layout16,layout17,layout18,layout19,
    layout20,layout21,layout22,layout23,layout24,layout25,layout26,layout27,layout28,layout29,
    layout30,layout31,layout32,layout33,layout34,layout35,layout36]
  ;(L[layout] || layout0)(ctx, W, H, theme, font, data)

  return canvas.toBuffer('image/png')
}

// ── HTTP 서버 ──
const SAMPLES = {
  ko: { title:'보톡스 시술 완벽 가이드', subtitle:'효과·지속기간·비용 총정리 2025', category:'skin-care', language:'ko',
        points:[{label:'⏱ 지속기간',value:'4~6개월 평균'},{label:'⏰ 시술시간',value:'15~30분 이내'},{label:'💰 평균비용',value:'10~30만원대'}] },
  en: { title:'NAD+ Therapy Complete Guide', subtitle:'Cellular Rejuvenation & Longevity 2025', category:'anti-aging', language:'en',
        points:[{label:'⚡ Energy Boost',value:'Up to 60% increase'},{label:'💉 Delivery',value:'IV drip or oral'},{label:'🧬 Target',value:'Mitochondrial health'}] },
  ja: { title:'インプラント治療 完全ガイド', subtitle:'費用・期間・注意点を徹底解説 2025', category:'dental', language:'ja',
        points:[{label:'🦷 治療期間',value:'3〜6ヶ月'},{label:'💴 費用相場',value:'30〜50万円'},{label:'✅ 成功率',value:'約95%以上'}] },
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}

  const url = new URL(req.url||'/', `http://localhost:${PORT}`)

  if(req.method==='GET' && url.pathname==='/health'){
    res.writeHead(200,{'Content-Type':'application/json'})
    res.end(JSON.stringify({ok:true})); return
  }

  if(url.pathname==='/image'){
    try{
      let data
      if(req.method==='GET'){
        const lang = url.searchParams.get('lang')||'ko'
        const cat  = url.searchParams.get('cat')
        data = {...(SAMPLES[lang]||SAMPLES.ko)}
        if(cat) data.category = cat
      } else {
        const body = await new Promise((ok,fail)=>{
          let s=''
          req.on('data',c=>s+=c); req.on('end',()=>ok(s)); req.on('error',fail)
        })
        data = JSON.parse(body)
      }
      const png = await generateCard(data)
      res.writeHead(200,{'Content-Type':'image/png','Content-Length':png.length,'Cache-Control':'no-store'})
      res.end(png)
    } catch(e){
      console.error('[img-server]',e)
      res.writeHead(500,{'Content-Type':'application/json'})
      res.end(JSON.stringify({error:String(e)}))
    }
    return
  }
  res.writeHead(404); res.end('Not found')
})

server.listen(PORT, ()=>{
  console.log(`🖼  이미지 서버: http://localhost:${PORT}`)
  console.log(`   샘플(KO): http://localhost:${PORT}/image?lang=ko`)
  console.log(`   샘플(JA): http://localhost:${PORT}/image?lang=ja`)
  console.log(`   샘플(EN): http://localhost:${PORT}/image?lang=en`)
})
