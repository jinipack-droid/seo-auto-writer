#!/usr/bin/env node
// HTML/CSS + Puppeteer 이미지 서버 - 포트 3002
// templates/card-news/ 폴더의 HTML 파일을 랜덤 선택하여 렌더링

import http from 'http'
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = path.join(__dirname, 'templates', 'card-news')
const PREVIEW_DIR   = path.join(__dirname, 'templates', 'preview')  // PR* 미리보기 전용
const PORT = 3002

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

// ── 템플릿 파일 목록 캐싱 (서버 재시작 없이도 새 파일 반영) ──
function getTemplateFiles() {
  try {
    return fs.readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith('.html'))
      .sort()
  } catch {
    return []
  }
}

// ── 언어별 폰트 스타일 주입 (시스템 폰트 사용 - Puppeteer 외부 폰트 로드 불안정)
function getFontLink(language) {
  // Windows/Mac 시스템 한국어 폰트를 weight별로 정확히 지정
  if (language === 'ko') {
    return `<style>
      @font-face {
        font-family: 'SystemKo';
        src: local('Noto Sans KR'), local('Apple SD Gothic Neo'), local('Malgun Gothic'), local('맑은 고딕');
        font-weight: 400;
      }
      @font-face {
        font-family: 'SystemKo';
        src: local('Noto Sans KR Bold'), local('Apple SD Gothic Neo Bold'), local('Malgun Gothic Bold'), local('맑은 고딕');
        font-weight: 700;
      }
    </style>`
  } else if (language === 'ja') {
    return `<style>
      @font-face { font-family: 'SystemJa'; src: local('Noto Sans JP'), local('Hiragino Kaku Gothic Pro'), local('Yu Gothic'), local('Meiryo'); font-weight: 400; }
      @font-face { font-family: 'SystemJa'; src: local('Noto Sans JP Bold'), local('Hiragino Kaku Gothic Pro'), local('Yu Gothic Bold'), local('Meiryo Bold'); font-weight: 700; }
    </style>`
  } else {
    return `<style>
      @font-face { font-family: 'SystemEn'; src: local('Segoe UI'), local('Helvetica Neue'), local('Arial'); font-weight: 400; }
      @font-face { font-family: 'SystemEn'; src: local('Segoe UI Bold'), local('Helvetica Neue Bold'), local('Arial Bold'); font-weight: 700; }
    </style>`
  }
}

function getFont(language) {
  return language === 'ja'
    ? "'SystemJa', 'Hiragino Kaku Gothic Pro', 'Yu Gothic', sans-serif"
    : language === 'ko'
    ? "'SystemKo', 'Malgun Gothic', '맑은 고딕', sans-serif"
    : "'SystemEn', 'Segoe UI', 'Helvetica Neue', sans-serif"
}

function getTitleFont(language) {
  return language === 'ja'
    ? "'SystemJa', 'Hiragino Kaku Gothic Pro', 'Yu Gothic', sans-serif"
    : language === 'ko'
    ? "'SystemKo', 'Malgun Gothic', '맑은 고딕', sans-serif"
    : "'SystemEn', 'Segoe UI', 'Helvetica Neue', sans-serif"
}

// ── 제목 길이 기반 폰트 크기 ──
function getFontSize(title) {
  const len = (title || '').length
  return len <= 7 ? 60 : len <= 11 ? 50 : len <= 15 ? 40 : len <= 20 ? 33 : 26
}

// ── 템플릿 HTML 파일에서 {{변수}} 치환 ──
function renderTemplate(templateHtml, data) {
  const { title = '', captions = [], category = 'health', language = 'ko', siteName = '' } = data
  const t = THEMES[category] || DEFAULT_THEME
  const caption1 = captions[0] || ''
  const fs = getFontSize(title)
  const today = new Date().toLocaleDateString('ko-KR')

  const vars = {
    '{{제목}}':    title,
    '{{부제목}}':  caption1,
    '{{캡션1}}':   caption1,
    '{{캡션2}}':   captions[1] || caption1,
    '{{캡션3}}':   captions[2] || caption1,
    '{{캡션4}}':   captions[3] || caption1,
    '{{캡션5}}':   captions[4] || caption1,
    '{{태그}}':    (category || '').replace(/-/g, ' '),
    '{{사이트}}':  siteName,
    '{{날짜}}':    today,
    '{{연도}}':    String(new Date().getFullYear()),
    '{{폰트링크}}': getFontLink(language),
    '{{폰트}}':    getFont(language),
    '{{폰트헤드}}': getTitleFont(language),
    '{{c1}}':      t.c1,
    '{{c2}}':      t.c2,
    '{{c3}}':      t.c3,
    '{{bg}}':      t.bg,
    '{{light}}':   t.light,
    '{{fs}}':      String(fs),
    '{{fs_small}}': String(Math.min(fs, 32)),
    '{{fs_large}}': String(title.length <= 8 ? 82 : title.length <= 12 ? 66 : title.length <= 16 ? 54 : 44),
  }

  let html = templateHtml
  for (const [key, val] of Object.entries(vars)) {
    // 전역 치환 (같은 변수가 여러 번 등장할 수 있으므로)
    html = html.split(key).join(val)
  }
  return html
}

// ── Puppeteer 브라우저 싱글턴 ──
let browser = null
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
             '--disable-dev-shm-usage', '--font-render-hinting=none',
             '--disable-web-security', '--allow-file-access-from-files'],
    })
    console.log('🚀 Puppeteer 브라우저 시작됨')
  }
  return browser
}

// ── 렌더링 동시 처리 제한 큐 (Puppeteer 과부하 방지) ──
// 갤러리 등에서 200개 동시 요청이 와도 MAX_CONCURRENT개만 실제로 렌더하고 나머지는 대기
const MAX_CONCURRENT = 2
let activeRenders = 0
const renderQueue = []

function queueRender(fn) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeRenders++
      try {
        resolve(await fn())
      } catch (e) {
        reject(e)
      } finally {
        activeRenders--
        if (renderQueue.length > 0) renderQueue.shift()()
      }
    }
    if (activeRenders < MAX_CONCURRENT) {
      run()
    } else {
      renderQueue.push(run)
    }
  })
}

// ── 최근 사용 템플릿 추적 (레이아웃 구조 중복 방지) ──
// 규칙: 같은 구조 레이아웃은 색상/테마가 달라도 동일 그룹으로 취급
// 예) T001(다크파랑)와 T002(라이트파랑)는 같은 구조(좌측패널+목록) → 그룹 0
// gen200.cjs 구조: li = Math.floor(idx0/2) % 50
// T001(idx0=0)→li=0, T002(idx0=1)→li=0 (같은 구조!)
// T101(idx0=100)→li=0 (같은 구조, 다른 색)
const recentTemplates = []
const RECENT_TRACK = 50  // 50개 구조 레이아웃 기억 → 게시글 내 중복 방지

function getLayoutGroup(filename) {
  // 새 100-레이아웃 구조: T001/T002/T101/T102 모두 li=0 (같은 구조 그룹)
  const m = filename.match(/T(\d+)\.html/i)
  if (!m) return -1
  const idx0 = parseInt(m[1]) - 1
  return Math.floor(idx0 / 2) % 50  // 0..49: 구조 레이아웃 그룹 (색상/테마 무관)
}

function pickTemplate(files) {
  if (files.length === 0) return null
  if (files.length <= 20) {
    // 파일이 적으면 그냥 랜덤
    return files[Math.floor(Math.random() * files.length)]
  }

  // 최근 사용한 레이아웃 그룹들
  const recentGroups = new Set(recentTemplates.map(f => getLayoutGroup(f)))

  // 최근에 안 쓴 파일들 우선
  const preferred = files.filter(f => !recentGroups.has(getLayoutGroup(f)))
  const pool = preferred.length > 0 ? preferred : files

  const chosen = pool[Math.floor(Math.random() * pool.length)]

  // 최근 목록 업데이트
  recentTemplates.push(chosen)
  if (recentTemplates.length > RECENT_TRACK) recentTemplates.shift()

  return chosen
}

// ── HTTP 서버 ──
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // ── GET /sample?lang=ko&cat=health&template=T001 ──
  if (req.method === 'GET' && url.pathname === '/sample') {
    const lang = url.searchParams.get('lang') || 'ko'
    const cat  = url.searchParams.get('cat')  || 'health'
    const tmpl = url.searchParams.get('template') || null

    const files = getTemplateFiles()
    if (files.length === 0) {
      res.writeHead(503); res.end('templates/card-news/ 폴더에 HTML 파일 없음'); return
    }

    // PR* 미리보기 템플릿은 preview 폴더에서 로드 (변수 이미 치환됨)
    const isPreview = tmpl && tmpl.toUpperCase().startsWith('PR')
    let chosen, templatePath, templateHtml

    if (isPreview) {
      chosen = tmpl.toUpperCase() + '.html'
      templatePath = path.join(PREVIEW_DIR, chosen)
      if (!fs.existsSync(templatePath)) {
        res.writeHead(404); res.end(`미리보기 파일 없음: ${chosen}`); return
      }
      templateHtml = fs.readFileSync(templatePath, 'utf-8')  // 이미 완성된 HTML
    } else {
      chosen = tmpl
        ? files.find(f => f.startsWith(tmpl)) || files[0]
        : files[Math.floor(Math.random() * files.length)]
      templatePath = path.join(TEMPLATES_DIR, chosen)
      templateHtml = fs.readFileSync(templatePath, 'utf-8')
    }

    const sampleData = {
      title: lang === 'ja' ? 'ビタミンC美白効果ガイド'
           : lang === 'ko' ? '비타민C 효능 완전 가이드'
           : 'Vitamin C Benefits Guide',
      captions: lang === 'ja'
        ? ['美白効果', '抗酸化作用', 'コラーゲン生成', '免疫力UP', '毎日の習慣']
        : lang === 'ko'
        ? ['미백 효과', '항산화 작용', '콜라겐 생성', '면역력 강화', '일상 섭취법']
        : ['Brightening', 'Antioxidant', 'Collagen Boost', 'Immunity', 'Daily intake'],
      category: cat,
      language: lang,
      siteName: 'SEO Writer',
    }
    try {
      const buf = await queueRender(async () => {
        const b = await getBrowser()
        const page = await b.newPage()
        await page.setViewport({ width: 500, height: 500 })
        // PR* 파일은 이미 완성된 HTML이므로 renderTemplate 생략
        const html = isPreview ? templateHtml : renderTemplate(templateHtml, sampleData)
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })
        const screenshot = await page.screenshot({ type: 'png' })
        await page.close()
        return screenshot
      })
      res.writeHead(200, { 'Content-Type': 'image/png', 'X-Template': chosen })
      res.end(buf)
      console.log(`📸 샘플 생성: ${chosen} (lang=${lang}, cat=${cat}) [큐대기:${renderQueue.length}]`)
    } catch (err) {
      console.error('❌ 샘플 렌더 오류:', err.message)
      res.writeHead(500); res.end(err.message)
    }
    return
  }

  // ── GET /templates ── 현재 템플릿 목록 조회 ──
  if (req.method === 'GET' && url.pathname === '/templates') {
    const files = getTemplateFiles()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ count: files.length, files }))
    return
  }

  // ── POST /image ── 이미지 생성 메인 ──
  if (req.method === 'POST' && url.pathname === '/image') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)

        // 템플릿 파일 랜덤 선택
        const files = getTemplateFiles()
        if (files.length === 0) {
          res.writeHead(503); res.end('templates/card-news/ 폴더에 HTML 파일 없음'); return
        }

        // 최근에 사용하지 않은 레이아웃 그룹에서 선택 (중복 방지)
        const chosen = pickTemplate(files)

        const templatePath = path.join(TEMPLATES_DIR, chosen)
        const templateHtml = fs.readFileSync(templatePath, 'utf-8')
        const html = renderTemplate(templateHtml, data)

        const buf = await queueRender(async () => {
          const b = await getBrowser()
          const page = await b.newPage()
          await page.setViewport({ width: 500, height: 500 })
          await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })
          const screenshot = await page.screenshot({ type: 'png' })
          await page.close()
          return screenshot
        })

        console.log(`✅ 이미지 생성: ${chosen} (title="${(data.title||'').slice(0,20)}") [큐:${renderQueue.length}]`)
        res.writeHead(200, { 'Content-Type': 'image/png', 'X-Template': chosen })
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
  const files = getTemplateFiles()
  console.log(`🖼  HTML 이미지 서버 (template-based): http://localhost:${PORT}`)
  console.log(`📁 템플릿 폴더: ${TEMPLATES_DIR}`)
  console.log(`📋 로드된 템플릿: ${files.length}개 → ${files.join(', ')}`)
  console.log(`샘플(KO): http://localhost:${PORT}/sample?lang=ko&cat=skin-care`)
  console.log(`샘플(JA): http://localhost:${PORT}/sample?lang=ja&cat=beauty`)
  console.log(`샘플(EN): http://localhost:${PORT}/sample?lang=en&cat=health`)
  console.log(`특정 템플릿: http://localhost:${PORT}/sample?template=T003&lang=ko`)
  console.log(`템플릿 목록: http://localhost:${PORT}/templates`)
})

// 종료 시 브라우저 닫기
process.on('SIGINT',  async () => { if (browser) await browser.close(); process.exit(0) })
process.on('SIGTERM', async () => { if (browser) await browser.close(); process.exit(0) })
