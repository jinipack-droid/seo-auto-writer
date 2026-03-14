import { createCanvas, GlobalFonts } from '@napi-rs/canvas'

// 카테고리별 색상 테마
const CATEGORY_THEMES: Record<string, { bg1: string; bg2: string; accent: string; badge: string }> = {
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

// 언어별 폰트 선택 (Windows 시스템 폰트)
function getFontFamily(language: 'ko' | 'en' | 'ja'): string {
  if (language === 'ko') return '"Malgun Gothic", "맑은 고딕", sans-serif'
  if (language === 'ja') return '"Yu Gothic", "游ゴシック", "MS Gothic", sans-serif'
  return '"Segoe UI", Arial, sans-serif'
}

// 폰트 초기화 (한 번만)
let fontsLoaded = false
function ensureFonts() {
  if (fontsLoaded) return
  // Windows 시스템 폰트 경로 직접 등록
  const winFonts = [
    { file: 'C:\\Windows\\Fonts\\malgun.ttf',   family: 'Malgun Gothic' },
    { file: 'C:\\Windows\\Fonts\\malgunbd.ttf', family: 'Malgun Gothic' },
    { file: 'C:\\Windows\\Fonts\\YuGothR.ttc',  family: 'Yu Gothic' },
    { file: 'C:\\Windows\\Fonts\\segoeui.ttf',  family: 'Segoe UI' },
    { file: 'C:\\Windows\\Fonts\\segoeuib.ttf', family: 'Segoe UI' },
  ]
  for (const f of winFonts) {
    try { GlobalFonts.registerFromPath(f.file, f.family) } catch {}
  }
  fontsLoaded = true
}

// 텍스트 줄바꿈
type Ctx2D = ReturnType<ReturnType<typeof createCanvas>['getContext']>
function wrapText(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  // CJK 문자 처리: 공백 없어도 글자 단위로 줄바꿈
  const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(text)
  if (isCJK) {
    const lines: string[] = []
    let line = ''
    for (const char of text) {
      const test = line + char
      if (ctx.measureText(test).width > maxWidth) {
        if (line) lines.push(line)
        line = char
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }
  // 영어: 단어 단위
  const words = text.split(' ')
  const lines: string[] = []
  let curr = ''
  for (const w of words) {
    const test = curr ? `${curr} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && curr) {
      lines.push(curr); curr = w
    } else { curr = test }
  }
  if (curr) lines.push(curr)
  return lines
}

// 그라데이션 배경
function drawBg(ctx: Ctx2D, w: number, h: number, c1: string, c2: string) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, c1); g.addColorStop(1, c2)
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
}

// 둥근 사각형 경로
function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// 왼쪽 원형 장식
function drawDeco(ctx: Ctx2D, accent: string) {
  const cx = 160, cy = 315
  // 외부 원
  ctx.beginPath(); ctx.arc(cx, cy, 130, 0, Math.PI * 2)
  ctx.fillStyle = accent + '18'; ctx.fill()
  // 내부 원
  ctx.beginPath(); ctx.arc(cx, cy, 88, 0, Math.PI * 2)
  ctx.fillStyle = accent + '28'; ctx.fill()
  // glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 88)
  glow.addColorStop(0, accent + '55'); glow.addColorStop(1, accent + '00')
  ctx.beginPath(); ctx.arc(cx, cy, 88, 0, Math.PI * 2)
  ctx.fillStyle = glow; ctx.fill()
  // 십자
  ctx.strokeStyle = accent + 'AA'; ctx.lineWidth = 7; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(cx - 36, cy); ctx.lineTo(cx + 36, cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, cy - 36); ctx.lineTo(cx, cy + 36); ctx.stroke()
}

export interface CardData {
  title: string
  subtitle?: string
  category: string
  language: 'ko' | 'en' | 'ja'
  points: { label: string; value: string }[]
  badgeText?: string
  siteName?: string
}

export async function generateCardImage(data: CardData): Promise<Uint8Array> {
  ensureFonts()

  const W = 1200, H = 630
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const theme = CATEGORY_THEMES[data.category] || DEFAULT_THEME
  const font = getFontFamily(data.language)

  // 배경
  drawBg(ctx, W, H, theme.bg1, theme.bg2)

  // 왼쪽 장식
  drawDeco(ctx, theme.accent)

  // 세로 구분선
  ctx.beginPath(); ctx.moveTo(320, 40); ctx.lineTo(320, H - 40)
  ctx.strokeStyle = theme.accent + '33'; ctx.lineWidth = 1; ctx.stroke()

  // ── 오른쪽 콘텐츠 영역 ──
  const lx = 360, rw = 800
  let y = 70

  // 카테고리 뱃지
  const badge = data.badgeText || data.category.replace(/-/g, ' ').toUpperCase()
  ctx.font = `bold 13px ${font}`
  const bw = ctx.measureText(badge).width + 28
  roundRect(ctx, lx, y, bw, 30, 6)
  ctx.fillStyle = theme.badge; ctx.fill()
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'
  ctx.fillText(badge, lx + 14, y + 15)
  y += 48

  // 메인 타이틀
  ctx.font = `bold 36px ${font}`
  ctx.fillStyle = '#FFFFFF'
  ctx.textBaseline = 'top'
  const titleLines = wrapText(ctx, data.title, rw - 20)
  titleLines.forEach(l => { ctx.fillText(l, lx, y); y += 48 })
  y += 4

  // 서브타이틀
  if (data.subtitle) {
    ctx.font = `19px ${font}`
    ctx.fillStyle = theme.accent + 'CC'
    const subLines = wrapText(ctx, data.subtitle, rw - 20)
    subLines.forEach(l => { ctx.fillText(l, lx, y); y += 28 })
    y += 4
  }

  // 구분선
  ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + rw, y)
  ctx.strokeStyle = theme.accent + '55'; ctx.lineWidth = 1.5; ctx.stroke()
  y += 24

  // 핵심 포인트 3개
  const points = data.points.slice(0, 3)
  points.forEach((pt, i) => {
    ctx.font = `13px ${font}`; ctx.fillStyle = '#888888'
    ctx.fillText(pt.label, lx, y); y += 22
    ctx.font = `bold 26px ${font}`; ctx.fillStyle = '#FFFFFF'
    ctx.fillText(pt.value, lx, y); y += 36
    if (i < points.length - 1) {
      ctx.beginPath(); ctx.moveTo(lx, y + 4); ctx.lineTo(lx + rw, y + 4)
      ctx.strokeStyle = '#FFFFFF11'; ctx.lineWidth = 1; ctx.stroke()
      y += 14
    }
  })

  // 하단 바
  const by = H - 42
  ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(lx + rw, by)
  ctx.strokeStyle = '#FFFFFF22'; ctx.lineWidth = 1; ctx.stroke()
  ctx.font = `12px ${font}`; ctx.fillStyle = '#555555'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${data.category}  ·  ${data.siteName || 'seo-auto-writer'}`, lx, by + 14)

  // Buffer → Uint8Array (NextResponse 호환)
  const buf = canvas.toBuffer('image/png')
  return new Uint8Array(buf)
}
