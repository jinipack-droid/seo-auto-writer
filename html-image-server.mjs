#!/usr/bin/env node
// HTML/CSS + Puppeteer 이미지 서버 - 포트 3001
// 10가지 완전히 다른 구조적 레이아웃

import http from 'http'
import puppeteer from 'puppeteer'

const PORT = 3001

// ── 카테고리별 색상 테마 ──
const THEMES = {
  'skin-care':         { c1: '#1976D2', c2: '#0D47A1', c3: '#4FC3F7', bg: '#0D1B2A', light: '#E3F2FD' },
  'medical-procedure': { c1: '#7B1FA2', c2: '#4A148C', c3: '#CE93D8', bg: '#1A0A2E', light: '#F3E5F5' },
  'dental':            { c1: '#1565C0', c2: '#0D47A1', c3: '#64B5F6', bg: '#0A1628', light: '#E8F5E9' },
  'anti-aging':        { c1: '#E65100', c2: '#BF360C', c3: '#FFB347', bg: '#0A0A0A', light: '#FFF3E0' },
  'supplements':       { c1: '#2E7D32', c2: '#1B5E20', c3: '#69DB7C', bg: '#0D2818', light: '#E8F5E9' },
  'beauty':            { c1: '#C2185B', c2: '#880E4F', c3: '#F48FB1', bg: '#2D0A1E', light: '#FCE4EC' },
  'health':            { c1: '#01579B', c2: '#0D47A1', c3: '#4FC3F7', bg: '#0A1628', light: '#E1F5FE' },
  'lifestyle':         { c1: '#388E3C', c2: '#2E7D32', c3: '#A5D6A7', bg: '#1B2A1B', light: '#E8F5E9' },
  'functional-food':   { c1: '#E65100', c2: '#BF360C', c3: '#FFCC80', bg: '#2A1500', light: '#FFF8E1' },
  'diet-clinic':       { c1: '#4527A0', c2: '#311B92', c3: '#B39DDB', bg: '#1A0A2E', light: '#EDE7F6' },
  'cancer-prevention': { c1: '#00695C', c2: '#004D40', c3: '#80CBC4', bg: '#0A2018', light: '#E0F2F1' },
  'mental-health':     { c1: '#283593', c2: '#1A237E', c3: '#9FA8DA', bg: '#0A1628', light: '#E8EAF6' },
  'medical-tourism':   { c1: '#00838F', c2: '#006064', c3: '#80DEEA', bg: '#0D1B2A', light: '#E0F7FA' },
}
const DEFAULT_THEME = { c1: '#01579B', c2: '#0D47A1', c3: '#4FC3F7', bg: '#0A1628', light: '#E1F5FE' }

function getTheme(category, variant = 0) {
  const base = THEMES[category] || DEFAULT_THEME
  // variant로 약간의 색상 변화 (hue shift)
  return base
}

// ── 10가지 HTML/CSS 레이아웃 템플릿 ──
function buildHTML(data) {
  const { title = '', captions = [], layout = 0, variant = 0, category = 'health', language = 'ko', siteName = '' } = data
  const t = getTheme(category, variant)
  const caption = captions[0] || ''
  const font = language === 'ja'
    ? "'Noto Sans JP', 'MS Gothic', sans-serif"
    : language === 'ko'
    ? "'Noto Sans KR', 'Malgun Gothic', sans-serif"
    : "'Segoe UI', Arial, sans-serif"
  const gfont = language === 'ja'
    ? 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap'
    : language === 'ko'
    ? 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap'
    : 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap'

  const base = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${gfont}" rel="stylesheet">`

  const W = 500, H = 500

  switch (layout % 10) {
    // ── 0: 매거진 스타일 (좌측 컬러 블록 + 우측 텍스트) ──
    case 0: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};display:flex;background:${t.bg}}
.left{width:380px;min-width:380px;background:linear-gradient(160deg,${t.c1},${t.c2});display:flex;flex-direction:column;justify-content:space-between;padding:48px 36px;position:relative}
.left::after{content:'';position:absolute;right:-40px;top:0;bottom:0;width:80px;background:inherit;clip-path:polygon(0 0,0 100%,100% 100%)}
.badge{background:rgba(255,255,255,0.2);color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;padding:6px 14px;border-radius:20px;display:inline-block;text-transform:uppercase}
.left-title{color:#fff;font-size:36px;font-weight:900;line-height:1.25;margin-top:20px}
.site{color:rgba(255,255,255,0.6);font-size:11px}
.right{flex:1;padding:50px 50px 50px 60px;display:flex;flex-direction:column;justify-content:center;gap:18px}
.main-title{color:#fff;font-size:40px;font-weight:900;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.caption{color:${t.c3};font-size:19px;font-weight:600;border-left:4px solid ${t.c3};padding-left:14px}
.divider{height:2px;background:linear-gradient(90deg,${t.c3},transparent);width:200px}
</style></head><body>
<div class="left">
  <div class="badge">${(category||'').replace(/-/g,' ')}</div>
  <div class="left-title">${caption}</div>
  <div class="site">${siteName}</div>
</div>
<div class="right">
  <div class="divider"></div>
  <div class="main-title">${title}</div>
  <div class="caption">${captions[1] || caption}</div>
</div>
</body></html>`

    // ── 1: 네온 글로우 스타일 ──
    case 1: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:#050510;position:relative;display:flex;align-items:center;justify-content:center}
.glow-ring{position:absolute;inset:20px;border:2px solid ${t.c3};border-radius:12px;box-shadow:0 0 30px ${t.c3}44,inset 0 0 30px ${t.c3}22}
.corner{position:absolute;width:24px;height:24px;border-color:${t.c1};border-style:solid}
.tl{top:28px;left:28px;border-width:3px 0 0 3px}
.tr{top:28px;right:28px;border-width:3px 3px 0 0}
.bl{bottom:28px;left:28px;border-width:0 0 3px 3px}
.br{bottom:28px;right:28px;border-width:0 3px 3px 0}
.content{position:relative;z-index:1;text-align:center;padding:0 80px;max-width:100%}
.cat{color:${t.c3};font-size:12px;letter-spacing:4px;text-transform:uppercase;font-weight:700;text-shadow:0 0 10px ${t.c3}88;margin-bottom:24px}
.title{color:#fff;font-size:44px;font-weight:900;line-height:1.25;text-shadow:0 0 20px rgba(255,255,255,0.3);margin-bottom:20px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.caption{color:${t.c3};font-size:18px;text-shadow:0 0 15px ${t.c3}88;font-weight:600}
.site{position:absolute;bottom:36px;right:48px;color:rgba(255,255,255,0.3);font-size:11px}
</style></head><body>
<div class="glow-ring"></div>
<div class="corner tl"></div><div class="corner tr"></div>
<div class="corner bl"></div><div class="corner br"></div>
<div class="content">
  <div class="cat">${(category||'').replace(/-/g,' ')}</div>
  <div class="title">${title}</div>
  <div class="caption">${caption}</div>
</div>
<div class="site">${siteName}</div>
</body></html>`

    // ── 2: 신문 헤드라인 스타일 ──
    case 2: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:#F5F0E8;color:#111}
.header{background:#111;color:${t.light};padding:10px 40px;display:flex;justify-content:space-between;align-items:center}
.header-title{font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.header-date{font-size:11px;color:#888}
.red-bar{height:6px;background:${t.c1}}
.content{padding:36px 48px;display:grid;grid-template-columns:1fr 360px;gap:40px;height:calc(100% - 70px)}
.main{display:flex;flex-direction:column;gap:16px;justify-content:center}
.kicker{color:${t.c1};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.headline{font-size:46px;font-weight:900;line-height:1.1;color:#111;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.sub{font-size:18px;color:#444;border-top:2px solid #111;padding-top:14px;line-height:1.4}
.sidebar{background:${t.c1};padding:28px;display:flex;flex-direction:column;gap:12px;justify-content:center}
.sidebar-label{color:${t.light}88;font-size:11px;text-transform:uppercase;letter-spacing:1px}
.sidebar-value{color:${t.light};font-size:22px;font-weight:700}
.site{font-size:11px;color:#888}
</style></head><body>
<div class="header"><span class="header-title">${siteName || 'SEO WRITER'}</span><span class="header-date">${new Date().toLocaleDateString('ko-KR')}</span></div>
<div class="red-bar"></div>
<div class="content">
  <div class="main">
    <div class="kicker">BREAKING · ${(category||'').replace(/-/g,' ')}</div>
    <div class="headline">${title}</div>
    <div class="sub">${caption}</div>
    <div class="site">${captions[1] || ''}</div>
  </div>
  <div class="sidebar">
    <div class="sidebar-label">핵심 포인트</div>
    ${captions.slice(0,3).map(c=>`<div class="sidebar-value">→ ${c}</div>`).join('')}
  </div>
</div>
</body></html>`

    // ── 3: 대각선 분할 그라데이션 ──
    case 3: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:${t.bg};position:relative}
.diagonal{position:absolute;top:0;right:0;width:55%;height:100%;background:linear-gradient(135deg,${t.c1}CC,${t.c2});clip-path:polygon(15% 0,100% 0,100% 100%,0% 100%)}
.content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;justify-content:center;padding:48px 60px}
.cat-badge{background:${t.c3};color:${t.bg};font-size:11px;font-weight:700;padding:6px 16px;border-radius:20px;display:inline-block;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;width:fit-content}
.title{color:#fff;font-size:44px;font-weight:900;line-height:1.25;max-width:560px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:16px}
.caption{color:${t.c3};font-size:19px;font-weight:600;max-width:500px}
.site{position:absolute;bottom:28px;left:60px;color:rgba(255,255,255,0.35);font-size:11px}
.right-content{position:absolute;right:60px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:14px;max-width:300px}
.right-item{color:rgba(255,255,255,0.9);font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;background:${t.c3};border-radius:50%;flex-shrink:0}
</style></head><body>
<div class="diagonal"></div>
<div class="content">
  <div class="cat-badge">${(category||'').replace(/-/g,' ')}</div>
  <div class="title">${title}</div>
  <div class="caption">${caption}</div>
  <div class="site">${siteName}</div>
</div>
<div class="right-content">
  ${captions.slice(1,4).map(c=>`<div class="right-item"><div class="dot"></div>${c}</div>`).join('')}
</div>
</body></html>`

    // ── 4: 인용문 카드 스타일 ──
    case 4: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:${t.bg};display:flex;align-items:center;justify-content:center}
.card{background:linear-gradient(145deg,#1a1a2e,#16213e);border-radius:20px;padding:56px 64px;width:1060px;position:relative;border:1px solid ${t.c3}33}
.quote-mark{position:absolute;top:-20px;left:60px;font-size:140px;color:${t.c3};line-height:1;opacity:0.4;font-family:Georgia,serif}
.cat{color:${t.c3};font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:28px}
.title{color:#fff;font-size:42px;font-weight:900;line-height:1.3;margin-bottom:28px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.divider{height:3px;background:linear-gradient(90deg,${t.c1},transparent);width:160px;margin-bottom:22px}
.caption{color:${t.c3};font-size:20px;font-style:italic;font-weight:600}
.footer{margin-top:28px;display:flex;justify-content:space-between;align-items:center}
.author{color:rgba(255,255,255,0.4);font-size:12px}
</style></head><body>
<div class="card">
  <div class="quote-mark">"</div>
  <div class="cat">${(category||'').replace(/-/g,' ')} · 전문 가이드</div>
  <div class="title">${title}</div>
  <div class="divider"></div>
  <div class="caption">${caption}</div>
  <div class="footer"><span class="author">${siteName}</span><span class="author">${captions[1] || ''}</span></div>
</div>
</body></html>`

    // ── 5: 대시보드 인포그래픽 ──
    case 5: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:${t.bg};display:flex;flex-direction:column}
.topbar{background:linear-gradient(90deg,${t.c1},${t.c2});padding:14px 48px;display:flex;justify-content:space-between;align-items:center}
.topbar-title{color:#fff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.topbar-pills{display:flex;gap:8px}
.pill{background:rgba(255,255,255,0.2);color:#fff;font-size:10px;padding:4px 12px;border-radius:20px;font-weight:600}
.main{flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:0}
.col{padding:36px 40px;display:flex;flex-direction:column;justify-content:center;gap:12px}
.col:not(:last-child){border-right:1px solid rgba(255,255,255,0.08)}
.col-num{color:${t.c3};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.col-main{color:#fff;font-size:28px;font-weight:900;line-height:1.2}
.col-sub{color:rgba(255,255,255,0.5);font-size:13px}
.fullcol{grid-column:1/-1;padding:28px 40px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:20px}
.big-title{color:#fff;font-size:32px;font-weight:900;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.site{color:rgba(255,255,255,0.3);font-size:11px}
</style></head><body>
<div class="topbar"><span class="topbar-title">${(category||'').replace(/-/g,' ')}</span>
<div class="topbar-pills">${captions.slice(0,2).map(c=>`<span class="pill">${c}</span>`).join('')}</div></div>
<div class="main">
  ${captions.slice(0,3).map((c,i)=>`<div class="col"><div class="col-num">0${i+1}</div><div class="col-main">${c}</div></div>`).join('')}
  <div class="fullcol"><div class="big-title">${title}</div><span class="site">${siteName}</span></div>
</div>
</body></html>`

    // ── 6: 세로 타임라인 ──
    case 6: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:${t.bg};display:grid;grid-template-columns:420px 1fr}
.left-panel{background:${t.c2};padding:48px 40px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden}
.bg-number{position:absolute;bottom:-30px;right:-10px;font-size:180px;font-weight:900;color:rgba(255,255,255,0.06);line-height:1}
.cat{color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px}
.panel-title{color:#fff;font-size:38px;font-weight:900;line-height:1.25;position:relative;z-index:1;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.site{position:absolute;bottom:24px;left:40px;color:rgba(255,255,255,0.35);font-size:11px}
.right-panel{padding:40px 48px;display:flex;flex-direction:column;gap:0}
.tl-item{display:flex;gap:20px;flex:1;align-items:center}
.tl-item:not(:last-child){border-bottom:1px solid rgba(255,255,255,0.08)}
.tl-dot-col{display:flex;flex-direction:column;align-items:center;gap:0;padding:16px 0}
.tl-dot{width:14px;height:14px;background:${t.c3};border-radius:50%;flex-shrink:0}
.tl-line{flex:1;width:2px;background:rgba(255,255,255,0.1)}
.tl-text{flex:1;padding:16px 0}
.tl-num{color:${t.c3};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.tl-cap{color:#fff;font-size:18px;font-weight:700;line-height:1.3}
</style></head><body>
<div class="left-panel">
  <div class="bg-number">0${(Math.floor(Math.random()*4)+1)}</div>
  <div class="cat">${(category||'').replace(/-/g,' ')}</div>
  <div class="panel-title">${title}</div>
  <div class="site">${siteName}</div>
</div>
<div class="right-panel">
  ${captions.slice(0,4).map((c,i)=>`
  <div class="tl-item">
    <div class="tl-dot-col"><div class="tl-dot"></div>${i<3?'<div class="tl-line"></div>':''}</div>
    <div class="tl-text"><div class="tl-num">STEP 0${i+1}</div><div class="tl-cap">${c}</div></div>
  </div>`).join('')}
</div>
</body></html>`

    // ── 7: 그리드 카드 (스티커 스타일) ──
    case 7: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:${t.light};display:flex;flex-direction:column}
.top{background:${t.c1};padding:22px 48px;display:flex;align-items:center;gap:16px}
.top-badge{background:rgba(255,255,255,0.2);color:#fff;font-size:10px;font-weight:700;letter-spacing:2px;padding:5px 14px;border-radius:4px;text-transform:uppercase}
.top-title{color:#fff;font-size:22px;font-weight:900;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.body{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px;background:#ddd}
.cell{background:#fff;padding:28px 32px;display:flex;flex-direction:column;justify-content:center;gap:8px;position:relative}
.cell:first-child{background:${t.c2};color:#fff}
.cell-num{font-size:11px;font-weight:700;letter-spacing:1px;color:${t.c3};text-transform:uppercase}
.cell:first-child .cell-num{color:rgba(255,255,255,0.6)}
.cell-text{font-size:20px;font-weight:900;color:#111;line-height:1.3}
.cell:first-child .cell-text{color:#fff;font-size:28px}
.site{position:absolute;bottom:10px;right:16px;font-size:10px;color:#bbb}
</style></head><body>
<div class="top">
  <span class="top-badge">${(category||'').replace(/-/g,' ')}</span>
  <span class="top-title">${title}</span>
</div>
<div class="body">
  <div class="cell"><div class="cell-num">핵심</div><div class="cell-text">${captions[0]||''}</div></div>
  <div class="cell"><div class="cell-num">01</div><div class="cell-text">${captions[1]||''}</div><span class="site">${siteName}</span></div>
  <div class="cell"><div class="cell-num">02</div><div class="cell-text">${captions[2]||''}</div></div>
  <div class="cell"><div class="cell-num">03</div><div class="cell-text">${captions[3]||''}</div></div>
</div>
</body></html>`

    // ── 8: 블루프린트 기술문서 스타일 ──
    case 8: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:#0a1628;position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(79,195,247,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(79,195,247,0.1) 1px,transparent 1px);background-size:40px 40px}
.content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;padding:40px 56px;gap:0}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${t.c3}44;padding-bottom:16px;margin-bottom:24px}
.header-left{display:flex;gap:20px;align-items:center}
.doc-id{color:${t.c3};font-size:11px;font-weight:700;letter-spacing:2px;font-family:monospace}
.cat-tag{border:1px solid ${t.c3}66;color:${t.c3};font-size:10px;padding:4px 10px;text-transform:uppercase;letter-spacing:1px}
.date{color:rgba(255,255,255,0.3);font-size:10px;font-family:monospace}
.title{color:#fff;font-size:44px;font-weight:900;line-height:1.2;margin-bottom:20px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.specs{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:${t.c3}22;flex:1}
.spec{background:#0a1628;padding:20px 24px;display:flex;flex-direction:column;gap:6px}
.spec-label{color:${t.c3}88;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-family:monospace}
.spec-value{color:#fff;font-size:16px;font-weight:700}
.footer{border-top:1px solid ${t.c3}33;padding-top:14px;margin-top:20px;display:flex;justify-content:space-between}
.footer-text{color:rgba(255,255,255,0.25);font-size:10px;font-family:monospace}
</style></head><body>
<div class="grid"></div>
<div class="content">
  <div class="header">
    <div class="header-left">
      <span class="doc-id">REF-${Math.random().toString(36).slice(2,8).toUpperCase()}</span>
      <span class="cat-tag">${(category||'').replace(/-/g,' ')}</span>
    </div>
    <span class="date">${new Date().toISOString().split('T')[0]}</span>
  </div>
  <div class="title">${title}</div>
  <div class="specs">
    ${captions.slice(0,4).map((c,i)=>`<div class="spec"><div class="spec-label">항목 ${String(i+1).padStart(2,'0')}</div><div class="spec-value">${c}</div></div>`).join('')}
  </div>
  <div class="footer"><span class="footer-text">${siteName}</span><span class="footer-text">© ${new Date().getFullYear()}</span></div>
</div>
</body></html>`

    // ── 9: 미니멀 타이포그래피 ──
    case 9: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}
<style>*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:${font};background:#fff;display:flex}
.accent{width:16px;background:linear-gradient(180deg,${t.c1},${t.c3})}
.main{flex:1;padding:56px 64px;display:flex;flex-direction:column;justify-content:space-between;background:#fff}
.top{display:flex;flex-direction:column;gap:12px}
.cat{font-size:11px;font-weight:700;letter-spacing:3px;color:${t.c1};text-transform:uppercase}
.title{font-size:52px;font-weight:900;line-height:1.1;color:#111;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.middle{display:flex;flex-direction:column;gap:10px}
.caption{font-size:20px;font-weight:600;color:#333}
.caption-sub{font-size:15px;color:#888}
.bottom{display:flex;justify-content:space-between;align-items:flex-end}
.tags{display:flex;gap:8px;flex-wrap:wrap}
.tag{background:${t.c1}15;color:${t.c1};font-size:11px;padding:5px 12px;border-radius:20px;font-weight:600}
.site{font-size:11px;color:#bbb}
</style></head><body>
<div class="accent"></div>
<div class="main">
  <div class="top">
    <div class="cat">${(category||'').replace(/-/g,' ')}</div>
    <div class="title">${title}</div>
  </div>
  <div class="middle">
    <div class="caption">${caption}</div>
    <div class="caption-sub">${captions[1]||''}</div>
  </div>
  <div class="bottom">
    <div class="tags">${captions.slice(2,5).map(c=>`<span class="tag">${c}</span>`).join('')}</div>
    <div class="site">${siteName}</div>
  </div>
</div>
</body></html>`

    default: return `<!DOCTYPE html><html><head><meta charset="UTF-8">${base}</head><body style="width:${W}px;height:${H}px;background:#0a1628;color:#fff;display:flex;align-items:center;justify-content:center;font-family:${font};font-size:32px">${title}</body></html>`
  }
}

// ── Puppeteer 브라우저 싱글턴 ──
let browser = null
async function getBrowser() {
  if (!browser || !browser.connected) {
    console.log('🚀 Puppeteer 브라우저 시작...')
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    })
    console.log('✅ 브라우저 준비 완료')
  }
  return browser
}

// ── HTTP 서버 ──
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('HTML Image Server OK - 10 layouts ready')
    return
  }

  // 샘플 이미지 (브라우저 테스트용)
  if (req.method === 'GET' && req.url?.startsWith('/sample')) {
    const urlParams = new URL(req.url, 'http://localhost')
    const layout = Number(urlParams.searchParams.get('layout') || 0)
    const lang = urlParams.searchParams.get('lang') || 'ko'
    const sampleData = {
      title: lang === 'ko' ? '건강한 생활을 위한 완벽 가이드 2024' : lang === 'ja' ? '健康的な生活のための完全ガイド' : 'Complete Guide to Healthy Living 2024',
      captions: ['핵심 정보 요약', '전문가 추천 방법', '실천 가이드', '주의사항', '결론'],
      layout, variant: 0, category: 'health', language: lang, siteName: 'viewmedi'
    }
    try {
      const b = await getBrowser()
      const page = await b.newPage()
      await page.setViewport({ width: 500, height: 500 })
      const html = buildHTML(sampleData)
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 })
      const buf = await page.screenshot({ type: 'png' })
      await page.close()
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(buf)
    } catch (e) {
      res.writeHead(500); res.end(e.message)
    }
    return
  }

  if (req.method === 'POST' && req.url === '/image') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        const layout = Number(data.layout ?? 0) % 10
        console.log(`🎨 layout=${layout}, captions=[${(data.captions||[]).slice(0,2).join('|')}]`)

        const b = await getBrowser()
        const page = await b.newPage()
        await page.setViewport({ width: 500, height: 500 })
        const html = buildHTML(data)
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 })
        const buf = await page.screenshot({ type: 'png' })
        await page.close()

        res.writeHead(200, { 'Content-Type': 'image/png' })
        res.end(buf)
      } catch (err) {
        console.error('❌ 이미지 생성 오류:', err.message)
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(err.message)
      }
    })
    return
  }

  res.writeHead(404); res.end('Not found')
})

// 브라우저 사전 시작
getBrowser().catch(console.error)

server.listen(PORT, () => {
  console.log(`🖼  HTML 이미지 서버: http://localhost:${PORT}`)
  console.log(`샘플(KO): http://localhost:${PORT}/sample?layout=0&lang=ko`)
  console.log(`샘플(KO): http://localhost:${PORT}/sample?layout=3&lang=ko`)
  console.log(`샘플(KO): http://localhost:${PORT}/sample?layout=7&lang=ko`)
})

// 종료 시 브라우저 닫기
process.on('SIGINT', async () => { if (browser) await browser.close(); process.exit(0) })
process.on('SIGTERM', async () => { if (browser) await browser.close(); process.exit(0) })
