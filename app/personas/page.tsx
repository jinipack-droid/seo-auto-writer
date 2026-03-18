'use client'
import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/lib/language-context'

interface Persona {
  id: string
  code: string
  name: string
  title: string
  language: string
  categories: string[]
  writing_style: string
  system_prompt: string
  is_active: boolean
  created_at: string
}

interface Site {
  id: string
  name: string
  url: string
  language: string
  is_active: boolean
}

const LANG_FLAGS: Record<string, string> = { en: '🇺🇸', ko: '🇰🇷', ja: '🇯🇵' }
const LANG_COLORS: Record<string, string> = { en: '#1E6AFF', ko: '#00c471', ja: '#f5a623' }

const GENDER_EMOJI = (code: string) => {
  if (code.includes('-F-')) return '👩'
  if (code.includes('-M-')) return '👨'
  return '🤖'
}

export default function PersonasPage() {
  const { lang } = useLang()

  // ── 기본 상태 ──
  const [personas,   setPersonas]   = useState<Persona[]>([])
  const [sites,      setSites]      = useState<Site[]>([])
  const [loading,    setLoading]    = useState(true)
  const [popup,      setPopup]      = useState<Persona | null>(null)
  const [editing,    setEditing]    = useState(false)
  const [form,       setForm]       = useState<Partial<Persona>>({})
  const [saving,     setSaving]     = useState(false)
  const [filterLang, setFilterLang] = useState<string>(lang)

  // 전역 언어 동기화
  useEffect(() => { setFilterLang(lang) }, [lang])

  // ── 팝업 내 글 생성 발행 ──
  const [genKw,      setGenKw]      = useState('')
  const [genSiteId,  setGenSiteId]  = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genResult,  setGenResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  // ── 행별 테스트 발행 ──
  const [testTarget,  setTestTarget]  = useState<Persona | null>(null)
  const [testKw,      setTestKw]      = useState('')
  const [testSiteId,  setTestSiteId]  = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult,  setTestResult]  = useState<{ ok: boolean; msg: string } | null>(null)
  const [testImageMode, setTestImageMode] = useState<'card' | 'photo' | 'both'>('card')

  // ── 미리보기 팝업 ──
  const [preview,        setPreview]        = useState<{ title: string; content: string; logId: string | null } | null>(null)
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishResult,  setPublishResult]  = useState<{ ok: boolean; msg: string; url?: string } | null>(null)

  // ── 예약 일괄 발행 ──
  const [showBulk,  setShowBulk]  = useState(false)
  const [bulkStart, setBulkStart] = useState('')
  const [bulkEnd,   setBulkEnd]   = useState('')
  const [bulkPPDMin, setBulkPPDMin] = useState(1)
  const [bulkPPDMax, setBulkPPDMax] = useState(2)
  const [bulkSites, setBulkSites] = useState<string[]>([])
  const [bulkMsg,   setBulkMsg]   = useState('')

  // ── 번역 ──
  const [translating, setTranslating] = useState(false)
  const [showKo,      setShowKo]      = useState(false)
  const [translated,  setTranslated]  = useState<Record<string, { name:string; title:string; writing_style:string; system_prompt:string }>>({})

  // ── 데이터 로드 ──
  const fetch_ = useCallback(async () => {
    setLoading(true)
    const [pRes, sRes] = await Promise.all([fetch('/api/personas'), fetch('/api/sites')])
    const pData = await pRes.json()
    const sData = await sRes.json()
    setPersonas(pData.personas || [])
    setSites(sData.sites || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetch_() }, [fetch_])

  const EMPTY: Partial<Persona> = {
    code:'', name:'', title:'', language:'en',
    categories:[], writing_style:'', system_prompt:'', is_active:true,
  }

  const filtered = filterLang === 'all' ? personas : personas.filter(p => p.language === filterLang)

  // ── 저장 ──
  const save = async () => {
    setSaving(true)
    try {
      if (form.id) {
        await fetch('/api/personas', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: form.id, ...form }) })
      } else {
        await fetch('/api/personas', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      }
      await fetch_()
      setEditing(false); setForm({})
    } finally { setSaving(false) }
  }

  // ── 번역 ──
  const translatePopup = async () => {
    if (!popup) return
    if (translated[popup.id]) { setShowKo(v => !v); return }
    setTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ texts: { name: popup.name, title: popup.title, writing_style: popup.writing_style, system_prompt: popup.system_prompt } }),
      })
      const data = await res.json()
      if (data.translated) { setTranslated(prev => ({ ...prev, [popup.id]: data.translated })); setShowKo(true) }
    } finally { setTranslating(false) }
  }

  // ── ON/OFF 토글 ──
  const toggleActive = async (p: Persona, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch('/api/personas', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: p.id, is_active: !p.is_active }) })
    setPersonas(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
  }

  // 팝업 열릴 때 gen 상태 초기화
  useEffect(() => { setGenKw(''); setGenSiteId(''); setGenResult(null) }, [popup])

  // ── 팝업 내 글 생성 발행 ──
  const handleGenerate = async () => {
    if (!popup || !genKw.trim() || !genSiteId) return
    setGenLoading(true); setGenResult(null)
    // 이미지 설정 읽기 (기본값: 이미지 생성 ON)
    let generateImage = true; let imageCount = 'random'; let imageCountMin = 1; let imageCountMax = 8
    try { const img = localStorage.getItem('image_settings'); if (img) { const s = JSON.parse(img); generateImage = s.generateImage ?? true; imageCount = s.imageCount || 'random'; imageCountMin = s.imageCountMin || 1; imageCountMax = s.imageCountMax || 8 } } catch {}
    // SEO 기본값 읽기
    let seoDefaults = {}
    try { const sd = localStorage.getItem('seo_defaults'); if (sd) seoDefaults = JSON.parse(sd) } catch {}
    try {
      const r = await fetch('/api/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ keyword: genKw, language: popup.language, personaCode: popup.code, siteIds: [genSiteId], sitePersonas: { [genSiteId]: popup.code }, contentType:'informational', scheduleType:'immediate', publishNow: true, generateImage, imageCount, imageCountMin, imageCountMax, seoDefaults }),
      })
      const d = await r.json()
      if (r.ok) setGenResult({ ok: true, msg: `✅ 글 생성 & 발행 완료!${generateImage ? ' (이미지 포함)' : ''} 발행 로그에서 확인하세요.` })
      else       setGenResult({ ok: false, msg: `❌ 오류: ${d.error}` })
    } catch { setGenResult({ ok: false, msg: '❌ 서버 연결 오류' }) }
    finally { setGenLoading(false) }
  }

  // ── 행별 테스트 발행 ──
  const openTest = (p: Persona, e: React.MouseEvent) => {
    e.stopPropagation()
    setTestTarget(p)
    setTestKw('')
    setTestSiteId('')
    setTestResult(null)
    setTestImageMode('card')
    // 해당 언어의 첫 번째 사이트 자동 선택
    const firstSite = sites.find(s => s.language === p.language)
    if (firstSite) setTestSiteId(firstSite.id)
  }

  // 1단계: 글 + 이미지 생성 (base64) → 미리보기 열기
  const handleTestPreview = async () => {
    if (!testTarget || !testKw.trim() || !testSiteId) return
    setTestLoading(true); setTestResult(null)
    // 이미지 설정 읽기
    let imageCount = 'random'; let imageCountMin = 1; let imageCountMax = 8
    try { const img = localStorage.getItem('image_settings'); if (img) { const s = JSON.parse(img); imageCount = s.imageCount || 'random'; imageCountMin = s.imageCountMin || 1; imageCountMax = s.imageCountMax || 8 } } catch {}
    // SEO 기본값 읽기
    let seoDefaults = {}
    try { const sd = localStorage.getItem('seo_defaults'); if (sd) seoDefaults = JSON.parse(sd) } catch {}
    try {
      const r = await fetch('/api/preview', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          keyword: testKw,
          language: testTarget.language,
          personaCode: testTarget.code,
          siteId: testSiteId,
          contentType: 'informational',
          imageCount, imageCountMin, imageCountMax, seoDefaults,
          imageMode: testImageMode,
        }),
      })
      const d = await r.json()
      if (r.ok && d.previewHtml) {
        setPreview({ title: d.title || testKw, content: d.previewHtml, logId: d.logId || null })
        setPublishResult(null)
      } else {
        setTestResult({ ok: false, msg: `❌ 오류: ${d.error || '글 생성 실패'}` })
      }
    } catch { setTestResult({ ok: false, msg: '❌ 서버 연결 오류' }) }
    finally { setTestLoading(false) }
  }

  // 2단계: 미리보기에서 실제 발행
  const handlePublishFromPreview = async () => {
    if (!preview?.logId) {
      setPublishResult({ ok: false, msg: '❌ 로그 ID가 없습니다. 다시 생성해주세요.' })
      return
    }
    setPublishLoading(true); setPublishResult(null)
    try {
      const r = await fetch(`/api/publish/${preview.logId}`, { method: 'POST' })
      const d = await r.json()
      if (r.ok && d.success) {
        setPublishResult({ ok: true, msg: `✅ 발행 완료! 이미지도 함께 업로드됐습니다.`, url: d.postUrl })
      } else {
        setPublishResult({ ok: false, msg: `❌ 발행 오류: ${d.error || '알 수 없는 오류'}` })
      }
    } catch { setPublishResult({ ok: false, msg: '❌ 서버 연결 오류' }) }
    finally { setPublishLoading(false) }
  }


  const inputSt: React.CSSProperties = {
    width:'100%', background:'#1a1a1a', border:'1px solid #2a2a2a',
    borderRadius:'6px', color:'#ccc', padding:'7px 10px', fontSize:'12px',
    outline:'none', boxSizing:'border-box',
  }
  const labelSt: React.CSSProperties = { fontSize:'10px', color:'#555', marginBottom:'4px', display:'block' }

  const testSites = testTarget ? sites.filter(s => s.language === testTarget.language) : []

  return (
    <div style={{ height:'calc(100vh - 84px)', display:'flex', flexDirection:'column', gap:'12px' }}>

      {/* ══ 행별 테스트 발행 팝업 (1단계: 키워드+사이트 입력) ══ */}
      {testTarget && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:2000,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#161616', border:'1px solid #2a2a2a', borderRadius:'16px',
            width:'440px', boxShadow:'0 24px 80px rgba(0,0,0,0.8)', padding:'24px',
          }}>
            {/* 팝업 헤더 */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'18px' }}>
              <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                <div style={{
                  width:'44px', height:'44px', borderRadius:'50%', flexShrink:0,
                  background:`${LANG_COLORS[testTarget.language]}22`,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px',
                }}>{GENDER_EMOJI(testTarget.code)}</div>
                <div>
                  <div style={{ fontSize:'15px', fontWeight:'800', color:'#fff' }}>{testTarget.name}</div>
                  <div style={{ display:'flex', gap:'5px', marginTop:'3px', alignItems:'center' }}>
                    <span style={{ fontSize:'10px', color: LANG_COLORS[testTarget.language],
                      background:`${LANG_COLORS[testTarget.language]}18`, padding:'1px 6px', borderRadius:'3px' }}>
                      {testTarget.code}
                    </span>
                    <span style={{ fontSize:'10px', color:'#555' }}>{testTarget.title}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setTestTarget(null)} style={{ background:'none', border:'none', color:'#444', fontSize:'20px', cursor:'pointer', flexShrink:0 }}>✕</button>
            </div>

            <div style={{ fontSize:'10px', fontWeight:'700', color:'#a78bfa', textTransform:'uppercase',
              letterSpacing:'0.5px', marginBottom:'12px' }}>🧪 테스트 발행 — 1단계: 내용 입력</div>


            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {/* 키워드 */}
              <div>
                <div style={{ ...labelSt, marginBottom:'5px' }}>키워드 / 글 주제</div>
                <input
                  style={inputSt}
                  value={testKw}
                  onChange={e => setTestKw(e.target.value)}
                  placeholder={
                    testTarget.language === 'en' ? 'e.g. vitamin c serum benefits' :
                    testTarget.language === 'ko' ? '예: 비타민C 세럼 효과' :
                    '例: ビタミンC 美容液'
                  }
                  onKeyDown={e => e.key === 'Enter' && handleTestPreview()}
                  autoFocus
                />
              </div>

              {/* 사이트 선택 */}
              <div>
                <div style={{ ...labelSt, marginBottom:'5px' }}>발행 사이트</div>
                {testSites.length === 0 ? (
                  <div style={{ padding:'8px 12px', borderRadius:'6px', background:'rgba(245,166,35,0.1)',
                    border:'1px solid rgba(245,166,35,0.3)', fontSize:'11px', color:'#f5a623' }}>
                    ⚠️ {LANG_FLAGS[testTarget.language]} {testTarget.language?.toUpperCase()} 언어의 등록된 사이트가 없습니다.
                    <a href="/sites" style={{ color:'#1E6AFF', marginLeft:'6px', textDecoration:'none' }}>사이트 등록 →</a>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                    {testSites.map(s => (
                      <label key={s.id} onClick={() => setTestSiteId(s.id)} style={{
                        display:'flex', alignItems:'center', gap:'10px', cursor:'pointer',
                        padding:'9px 12px', borderRadius:'7px',
                        background: testSiteId === s.id ? `${LANG_COLORS[testTarget.language]}15` : '#1c1c1c',
                        border: `1px solid ${testSiteId === s.id ? LANG_COLORS[testTarget.language] : '#252525'}`,
                        transition:'all 0.15s',
                      }}>
                        <div style={{
                          width:'16px', height:'16px', borderRadius:'50%', flexShrink:0,
                          border: `2px solid ${testSiteId === s.id ? LANG_COLORS[testTarget.language] : '#333'}`,
                          background: testSiteId === s.id ? LANG_COLORS[testTarget.language] : 'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          {testSiteId === s.id && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#fff' }} />}
                        </div>
                        <span style={{ fontSize:'12px', color: testSiteId === s.id ? '#fff' : '#888', flex:1 }}>{s.name}</span>
                        <span style={{ fontSize:'10px', color:'#444' }}>{LANG_FLAGS[s.language]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 미리보기 확인 버튼 */}
              <button
                onClick={handleTestPreview}
                disabled={testLoading || !testKw.trim() || !testSiteId}
                style={{
                  marginTop:'4px', padding:'12px', borderRadius:'8px', cursor:'pointer',
                  background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                  border:'none', color:'#fff', fontSize:'13px', fontWeight:'800',
                  opacity: (testLoading || !testKw.trim() || !testSiteId) ? 0.4 : 1,
                  transition:'opacity 0.2s',
                }}>
                {testLoading ? '⏳ 글과 이미지 생성 중... (약 5분)' : '👁 글 생성 및 미리보기 확인'}
              </button>

              {/* 오류 결과 */}
              {testResult && (
                <div style={{
                  padding:'10px 14px', borderRadius:'8px', fontSize:'12px', lineHeight:'1.6',
                  background: testResult.ok ? 'rgba(0,196,113,0.1)' : 'rgba(255,68,68,0.1)',
                  color: testResult.ok ? '#00c471' : '#ff4444',
                  border: `1px solid ${testResult.ok ? 'rgba(0,196,113,0.3)' : 'rgba(255,68,68,0.3)'}`,
                }}>{testResult.msg}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ 미리보기 팝업 (2단계: 내용 확인 후 발행) ══ */}
      {preview && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2100,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#161616', border:'1px solid #2a2a2a', borderRadius:'16px',
            width:'780px', maxWidth:'95vw', maxHeight:'90vh',
            display:'flex', flexDirection:'column',
            boxShadow:'0 32px 100px rgba(0,0,0,0.9)',
          }}>
            {/* 미리보기 헤더 */}
            <div style={{
              padding:'18px 24px', borderBottom:'1px solid #222',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'linear-gradient(90deg, rgba(14,165,233,0.08), rgba(99,102,241,0.08))',
              flexShrink:0, borderRadius:'16px 16px 0 0',
            }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'800', color:'#fff', marginBottom:'3px' }}>
                  👁 미리보기 — 2단계: 내용 확인 후 발행
                </div>
                <div style={{ fontSize:'11px', color:'#888', maxWidth:'550px',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {preview.title}
                </div>
              </div>
              <button onClick={() => { setPreview(null); setPublishResult(null) }}
                style={{ background:'none', border:'none', color:'#555', fontSize:'20px', cursor:'pointer', flexShrink:0 }}>✕</button>
            </div>

            {/* 발행 결과 */}
            {publishResult && (
              <div style={{
                margin:'12px 24px 0', padding:'12px 16px', borderRadius:'8px', fontSize:'12px', lineHeight:'1.6',
                background: publishResult.ok ? 'rgba(0,196,113,0.1)' : 'rgba(255,68,68,0.1)',
                color: publishResult.ok ? '#00c471' : '#ff4444',
                border: `1px solid ${publishResult.ok ? 'rgba(0,196,113,0.3)' : 'rgba(255,68,68,0.3)'}`,
                flexShrink:0,
              }}>
                {publishResult.msg}
                {publishResult.url && (
                  <a href={publishResult.url} target="_blank" rel="noopener noreferrer"
                    style={{ color:'#60a5fa', marginLeft:'10px', textDecoration:'underline' }}>
                    → 발행된 글 보기
                  </a>
                )}
              </div>
            )}

            {/* HTML 미리보기 영역 — WordPress 스타일 렌더링 */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
              <style>{`
                .wp-preview h1 { font-size:2em; font-weight:800; line-height:1.3; margin:0 0 16px; color:#f0f0f0; }
                .wp-preview h2 { font-size:1.45em; font-weight:700; line-height:1.4; margin:28px 0 12px; color:#e0e0e0; border-left:4px solid #1E6AFF; padding-left:12px; }
                .wp-preview h3 { font-size:1.18em; font-weight:600; line-height:1.4; margin:20px 0 8px; color:#d0d0d0; }
                .wp-preview p  { margin:0 0 14px; color:#bbb; line-height:1.9; }
                .wp-preview ul, .wp-preview ol { margin:0 0 14px 20px; color:#bbb; line-height:1.9; }
                .wp-preview li { margin-bottom:6px; }
                .wp-preview strong { color:#fff; font-weight:700; }
                .wp-preview em { color:#ccc; font-style:italic; }
                .wp-preview blockquote {
                  margin:20px 0; padding:16px 20px;
                  border-left:4px solid #a78bfa;
                  background:rgba(167,139,250,0.08);
                  border-radius:0 8px 8px 0;
                  color:#c4b5fd; font-style:italic;
                }
                .wp-preview blockquote p { color:#c4b5fd; margin:0; }
                .wp-preview table { width:100%; border-collapse:collapse; margin:16px 0; font-size:0.92em; }
                .wp-preview th { background:#1e1e2e; color:#a78bfa; padding:8px 12px; border:1px solid #333; text-align:left; }
                .wp-preview td { padding:8px 12px; border:1px solid #2a2a2a; color:#bbb; }
                .wp-preview tr:nth-child(even) td { background:#1a1a1a; }
                .wp-preview figure { margin:16px 0; text-align:center; }
                .wp-preview figure img { max-width:100%; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.5); }
                .wp-preview figcaption { font-size:0.8em; color:#555; margin-top:6px; }
                .wp-preview .disclaimer { font-size:0.85em; color:#666; border:1px solid #2a2a2a; padding:10px 14px; border-radius:6px; margin-top:20px; }
                .wp-preview .faq-section h2 { color:#60a5fa; }
                .wp-preview .faq-item { margin-bottom:14px; padding:12px 16px; background:#1a1a2e; border-radius:8px; border:1px solid #2a2a3a; }
                .wp-preview .faq-item h3 { margin:0 0 6px; color:#93c5fd; font-size:1em; }
                .wp-preview .cta-section { background:rgba(30,106,255,0.08); border:1px solid rgba(30,106,255,0.25); border-radius:10px; padding:16px 20px; margin:20px 0; }
                .wp-preview .checklist { list-style:none; margin-left:0; }
                .wp-preview .checklist li::before { content:'☐ '; color:#555; }
                .wp-preview a { color:#60a5fa; }
                .wp-preview section { margin-bottom:20px; }
                .wp-preview .comparison-table th { background:#1c1c2e; }
              `}</style>
              <div
                className="wp-preview"
                style={{
                  background:'#111', border:'1px solid #222', borderRadius:'8px',
                  padding:'28px 32px', fontSize:'14px', lineHeight:'1.9', color:'#bbb',
                  fontFamily:'"Noto Sans KR", "Helvetica Neue", sans-serif',
                }}
                dangerouslySetInnerHTML={{ __html: (
                  preview.content
                    .replace(/<!--\s*META:[\s\S]*?-->/g, '')
                    .replace(/<!--\s*TITLE:[\s\S]*?-->/g, '')
                    .replace(/<!--\s*SCHEMA:[\s\S]*?-->/g, '')
                    .replace(/<!--\s*PROMPT_ID:[\s\S]*?-->/g, '')
                    .replace(/<!--\s*IMG_CAPS:[\s\S]*?-->/g, '')
                ) }}
              />
            </div>

            {/* 하단 발행 버튼 */}
            <div style={{
              padding:'16px 24px', borderTop:'1px solid #222', flexShrink:0,
              display:'flex', gap:'10px', alignItems:'center',
              background:'#111', borderRadius:'0 0 16px 16px',
            }}>
              <button
                onClick={() => { setPreview(null); setPublishResult(null) }}
                style={{
                  padding:'10px 20px', borderRadius:'8px', cursor:'pointer',
                  background:'transparent', border:'1px solid #333', color:'#777', fontSize:'12px',
                }}>
                ← 다시 수정
              </button>
              <div style={{ flex:1 }} />
              {!publishResult?.ok && (
                <button
                  onClick={handlePublishFromPreview}
                  disabled={publishLoading || !preview.logId}
                  style={{
                    padding:'12px 28px', borderRadius:'8px', cursor:'pointer',
                    background: 'linear-gradient(135deg, #7c3aed, #1E6AFF)',
                    border:'none', color:'#fff', fontSize:'14px', fontWeight:'800',
                    opacity: (publishLoading || !preview.logId) ? 0.5 : 1,
                    transition:'opacity 0.2s',
                  }}>
                  {publishLoading ? '⏳ 발행 중... (이미지 포함, 최대 5분)' : '🚀 이대로 발행하기'}
                </button>
              )}
              {publishResult?.ok && (
                <button
                  onClick={() => { setPreview(null); setPublishResult(null); setTestTarget(null) }}
                  style={{
                    padding:'12px 28px', borderRadius:'8px', cursor:'pointer',
                    background:'#00c471', border:'none', color:'#fff', fontSize:'14px', fontWeight:'800',
                  }}>
                  ✅ 완료 — 닫기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ 예약 일괄 발행 팝업 ══ */}
      {showBulk && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:2000,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#161616', border:'1px solid #2a2a2a', borderRadius:'16px',
            width:'520px', maxHeight:'90vh', overflowY:'auto',
            boxShadow:'0 24px 80px rgba(0,0,0,0.8)', padding:'28px',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <div style={{ fontSize:'16px', fontWeight:'800', color:'#fff' }}>📅 예약 일괄 발행</div>
                <div style={{ fontSize:'11px', color:'#555', marginTop:'3px' }}>날짜 범위를 선택하면 해당 기간 매일 발행됩니다</div>
              </div>
              <button onClick={() => setShowBulk(false)} style={{ background:'none', border:'none', color:'#444', fontSize:'20px', cursor:'pointer' }}>✕</button>
            </div>

            {/* 빠른 기간 선택 */}
            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:'#555', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>빠른 기간 선택</div>
              <div style={{ display:'flex', gap:'6px' }}>
                {([['1개월',1],['3개월',3],['6개월',6],['1년',12]] as [string,number][]).map(([label, months]) => {
                  const s = new Date(); s.setDate(1)
                  const e2 = new Date(s); e2.setMonth(e2.getMonth() + months)
                  const fmt = (d: Date) => d.toISOString().slice(0,10)
                  const active = bulkStart === fmt(s) && bulkEnd === fmt(e2)
                  return (
                    <button key={label} onClick={() => { setBulkStart(fmt(s)); setBulkEnd(fmt(e2)) }}
                      style={{ flex:1, padding:'7px', borderRadius:'6px', cursor:'pointer', fontSize:'12px',
                        background: active ? 'rgba(30,106,255,0.2)' : '#1c1c1c',
                        border: `1px solid ${active ? '#1E6AFF' : '#2a2a2a'}`,
                        color: active ? '#1E6AFF' : '#888',
                      }}>{label}</button>
                  )
                })}
              </div>
            </div>

            {/* 날짜 범위 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
              <div>
                <div style={{ fontSize:'10px', color:'#555', marginBottom:'5px' }}>시작일</div>
                <input type="date" value={bulkStart} onChange={e => setBulkStart(e.target.value)} style={{ ...inputSt, cursor:'pointer' }} />
              </div>
              <div>
                <div style={{ fontSize:'10px', color:'#555', marginBottom:'5px' }}>종료일</div>
                <input type="date" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} style={{ ...inputSt, cursor:'pointer' }} />
              </div>
            </div>

            {/* 사이트당 하루 발행 글수 (랜덤 범위) */}
            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:'#555', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' }}>
                사이트당 하루 발행 글수 &nbsp;
                <span style={{ color:'#1E6AFF', fontWeight:'800' }}>{bulkPPDMin}~{bulkPPDMax}개 랜덤</span>
              </div>
              <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'10px', color:'#666', marginBottom:'4px' }}>최소</div>
                  <input type="range" min={1} max={20} value={bulkPPDMin}
                    onChange={e => { const v = +e.target.value; setBulkPPDMin(v); if (v > bulkPPDMax) setBulkPPDMax(v) }}
                    style={{ width:'100%', accentColor:'#1E6AFF' }} />
                  <div style={{ fontSize:'10px', color:'#1E6AFF', textAlign:'center', marginTop:'2px' }}>{bulkPPDMin}개</div>
                </div>
                <div style={{ fontSize:'16px', color:'#444', paddingTop:'8px' }}>~</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'10px', color:'#666', marginBottom:'4px' }}>최대</div>
                  <input type="range" min={1} max={20} value={bulkPPDMax}
                    onChange={e => { const v = +e.target.value; setBulkPPDMax(v); if (v < bulkPPDMin) setBulkPPDMin(v) }}
                    style={{ width:'100%', accentColor:'#1E6AFF' }} />
                  <div style={{ fontSize:'10px', color:'#1E6AFF', textAlign:'center', marginTop:'2px' }}>{bulkPPDMax}개</div>
                </div>
              </div>
              <div style={{ fontSize:'10px', color:'#555', marginTop:'6px', textAlign:'center' }}>
                💡 매일 {bulkPPDMin}~{bulkPPDMax}개 사이에서 랜덤 발행 → 자연스러운 패턴
              </div>
            </div>

            {/* 발행 시각 */}
            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:'#555', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>발행 시각</div>
              <div style={{ padding:'10px 14px', borderRadius:'8px', background:'rgba(0,196,113,0.06)', border:'1px solid rgba(0,196,113,0.25)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'16px' }}>🎲</span>
                <div>
                  <div style={{ fontSize:'12px', color:'#00c471', fontWeight:'700' }}>하루 중 랜덤 시간 발행</div>
                  <div style={{ fontSize:'10px', color:'#555', marginTop:'2px' }}>오전 6시 ~ 자정 사이 랜덤 → 사람처럼 자연스러운 패턴</div>
                </div>
              </div>
            </div>

            {/* 대상 사이트 */}
            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:'#555', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>대상 사이트</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                {sites.filter(s => filterLang === 'all' || s.language === filterLang).map(s => (
                  <label key={s.id} style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer',
                    padding:'7px 10px', borderRadius:'6px', background:'#1c1c1c', border:'1px solid #252525' }}>
                    <input type="checkbox"
                      checked={bulkSites.includes(s.id)}
                      onChange={e => setBulkSites(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                      style={{ accentColor:'#1E6AFF' }} />
                    <span style={{ fontSize:'12px', color:'#aaa' }}>{s.name}</span>
                    <span style={{ fontSize:'10px', color:'#444', marginLeft:'auto' }}>{LANG_FLAGS[s.language]}</span>
                  </label>
                ))}
                {sites.length === 0 && <div style={{ fontSize:'12px', color:'#444', textAlign:'center', padding:'12px' }}>등록된 사이트 없음</div>}
              </div>
            </div>

            {/* 예상 총 발행 수 */}
            {bulkStart && bulkEnd && (() => {
              const d = Math.max(0, Math.ceil((new Date(bulkEnd).getTime() - new Date(bulkStart).getTime()) / 86400000) + 1)
              const totalMin = d * bulkPPDMin * Math.max(1, bulkSites.length)
              const totalMax = d * bulkPPDMax * Math.max(1, bulkSites.length)
              return (
                <div style={{ padding:'12px 16px', borderRadius:'8px', background:'rgba(30,106,255,0.07)',
                  border:'1px solid rgba(30,106,255,0.2)', marginBottom:'16px', textAlign:'center' }}>
                  <div style={{ fontSize:'22px', fontWeight:'800', color:'#1E6AFF' }}>{totalMin.toLocaleString()}~{totalMax.toLocaleString()}건</div>
                  <div style={{ fontSize:'11px', color:'#555', marginTop:'2px' }}>예상 총 발행 ({d}일 × {bulkPPDMin}~{bulkPPDMax}개 랜덤 × {Math.max(1,bulkSites.length)}사이트)</div>
                </div>
              )
            })()}

            {bulkMsg && (
              <div style={{ padding:'8px 12px', borderRadius:'6px', marginBottom:'12px', fontSize:'12px',
                background:'rgba(0,196,113,0.1)', color:'#00c471', border:'1px solid rgba(0,196,113,0.3)' }}>
                {bulkMsg}
              </div>
            )}

            <button
              disabled={!bulkStart || !bulkEnd || bulkSites.length === 0}
              onClick={() => setBulkMsg(`✅ ${bulkStart} ~ ${bulkEnd} 예약 스케줄 설정 완료!`)}
              style={{ width:'100%', padding:'12px', borderRadius:'8px', cursor:'pointer',
                background:'#1E6AFF', border:'none', color:'#fff', fontSize:'14px', fontWeight:'800',
                opacity: (!bulkStart || !bulkEnd || bulkSites.length === 0) ? 0.4 : 1 }}>
              📅 예약 스케줄 설정
            </button>
          </div>
        </div>
      )}

      {/* ── 헤더 ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'16px', fontWeight:'800', color:'#fff' }}>👤 아이디&페르소나</span>
          <span style={{ fontSize:'12px', color:'#555', background:'#1c1c1c', padding:'2px 8px', borderRadius:'4px' }}>
            {filtered.length}명
          </span>
          {/* 예약 일괄 발행 - 타이틀 옆으로 이동 */}
          <button onClick={() => { setBulkMsg(''); setShowBulk(true) }} style={{
            marginLeft:'8px', padding:'5px 12px', background:'#1c1c1c', border:'1px solid #333',
            borderRadius:'6px', color:'#aaa', fontSize:'11px', fontWeight:'600', cursor:'pointer',
          }}>📅 예약 일괄 발행</button>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={() => { setForm(EMPTY); setEditing(true) }} style={{
            padding:'7px 14px', background:'#1E6AFF', border:'none',
            borderRadius:'6px', color:'#fff', fontSize:'12px', fontWeight:'700', cursor:'pointer',
          }}>+ 새 아이디</button>
        </div>
      </div>


      {/* ── 아이디 목록 ── */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {loading ? (
          <div style={{ padding:'60px', textAlign:'center', color:'#444' }}>불러오는 중...</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #252525' }}>
                  {['#','언어','코드','이름','직함','담당 카테고리','매칭 사이트','상태','테스트'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', color:'#555', fontWeight:'600',
                      fontSize:'10px', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const matchedSites = sites.filter(s => s.language === p.language)
                  return (
                    <tr key={p.id}
                      onClick={() => setPopup(p)}
                      style={{ borderBottom:'1px solid #1e1e1e', cursor:'pointer', transition:'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1c1c1c')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding:'10px 12px', color:'#333', fontSize:'11px', textAlign:'center', minWidth:'36px' }}>{idx + 1}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:'15px' }}>{LANG_FLAGS[p.language]}</span>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:'10px', color: LANG_COLORS[p.language],
                          background:`${LANG_COLORS[p.language]}18`, padding:'2px 6px', borderRadius:'3px' }}>
                          {p.code}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', color:'#fff', fontWeight:'600', whiteSpace:'nowrap' }}>
                        {GENDER_EMOJI(p.code)} {p.name}
                      </td>
                      <td style={{ padding:'10px 12px', color:'#666', maxWidth:'180px',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {p.title}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                          {(p.categories||[]).slice(0,3).map(c => (
                            <span key={c} style={{ fontSize:'9px', color:'#555', background:'#222', padding:'2px 6px', borderRadius:'3px' }}>{c}</span>
                          ))}
                          {(p.categories||[]).length > 3 && <span style={{ fontSize:'9px', color:'#444' }}>+{p.categories.length-3}</span>}
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {matchedSites.length === 0 ? (
                          <span style={{ fontSize:'10px', color:'#333' }}>— 없음</span>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                            {matchedSites.slice(0,2).map(s => (
                              <span key={s.id} style={{ fontSize:'10px', color:'#888', background:'#1e1e1e', padding:'2px 6px', borderRadius:'3px', whiteSpace:'nowrap' }}>{s.name}</span>
                            ))}
                            {matchedSites.length > 2 && <span style={{ fontSize:'9px', color:'#444' }}>+{matchedSites.length-2}</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <button
                          onClick={e => toggleActive(p, e)}
                          style={{ background:'transparent',
                            border:`1px solid ${p.is_active?'#00c471':'#333'}`,
                            borderRadius:'4px', padding:'2px 8px', fontSize:'10px',
                            cursor:'pointer', color: p.is_active?'#00c471':'#444' }}>
                          {p.is_active?'ON':'OFF'}
                        </button>
                      </td>
                      {/* 행별 테스트 발행 버튼 */}
                      <td style={{ padding:'10px 12px' }}>
                        <button
                          onClick={e => openTest(p, e)}
                          title={`${p.name} 테스트 발행`}
                          style={{
                            padding:'3px 10px', borderRadius:'5px', cursor:'pointer', fontSize:'11px', fontWeight:'700',
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(30,106,255,0.2))',
                            border: '1px solid rgba(124,58,237,0.4)',
                            color: '#a78bfa', whiteSpace:'nowrap',
                            transition:'all 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed'; (e.currentTarget as HTMLButtonElement).style.color = '#c4b5fd' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,58,237,0.4)'; (e.currentTarget as HTMLButtonElement).style.color = '#a78bfa' }}
                        >
                          🧪 테스트
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════ 상세 팝업 ══════════ */}
      {popup && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
          zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#161616', border:'1px solid #2a2a2a',
            borderRadius:'14px', width:'540px', maxHeight:'85vh',
            overflow:'hidden', display:'flex', flexDirection:'column',
            boxShadow:'0 24px 80px rgba(0,0,0,0.7)',
          }}>
            {/* 팝업 헤더 */}
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #222',
              display:'flex', gap:'14px', alignItems:'flex-start',
              background:`${LANG_COLORS[popup.language]}08` }}>
              <div style={{ width:'52px', height:'52px', borderRadius:'50%', flexShrink:0,
                background:`${LANG_COLORS[popup.language]}22`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:'26px',
              }}>{GENDER_EMOJI(popup.code)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'18px', fontWeight:'800', color:'#fff', marginBottom:'4px' }}>
                  {showKo && translated[popup.id] ? translated[popup.id].name : popup.name}
                </div>
                <div style={{ fontSize:'12px', color:'#888', marginBottom:'8px' }}>
                  {showKo && translated[popup.id] ? translated[popup.id].title : popup.title}
                </div>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:'10px', color: LANG_COLORS[popup.language],
                    background:`${LANG_COLORS[popup.language]}18`, padding:'2px 8px', borderRadius:'4px', fontWeight:'700' }}>
                    {popup.code}
                  </span>
                  <span style={{ fontSize:'10px', color:'#666', background:'#222', padding:'2px 8px', borderRadius:'4px' }}>
                    {LANG_FLAGS[popup.language]} {popup.language?.toUpperCase()}
                  </span>
                  <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'4px',
                    color: popup.is_active ? '#00c471' : '#ff4444',
                    background: popup.is_active ? 'rgba(0,196,113,0.1)' : 'rgba(255,68,68,0.1)',
                  }}>{popup.is_active ? '✅ 활성' : '⛔ 비활성'}</span>
                  {popup.language !== 'ko' && (
                    <button onClick={translatePopup} disabled={translating} style={{
                      padding:'2px 10px', borderRadius:'4px', fontSize:'10px', cursor:'pointer',
                      border:`1px solid ${showKo ? '#00c471' : '#2a2a2a'}`,
                      background: showKo ? 'rgba(0,196,113,0.1)' : '#1e1e1e',
                      color: showKo ? '#00c471' : '#666', transition:'all 0.2s',
                    }}>
                      {translating ? '번역 중...' : showKo ? '🇰🇷 한국어 보기 중' : '🇰🇷 한국어로 보기'}
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => setPopup(null)} style={{ background:'transparent', border:'none', color:'#444', fontSize:'20px', cursor:'pointer' }}>✕</button>
            </div>

            {/* 팝업 본문 */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#555', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'8px' }}>담당 카테고리</div>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  {(popup.categories || []).map(c => (
                    <span key={c} style={{ fontSize:'12px', color:'#aaa', background:'#222', padding:'4px 10px', borderRadius:'5px', border:'1px solid #2a2a2a' }}>{c}</span>
                  ))}
                </div>
              </div>
              {popup.writing_style && (
                <div>
                  <div style={{ fontSize:'10px', fontWeight:'700', color:'#555', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'8px' }}>글쓰기 스타일</div>
                  <div style={{ fontSize:'12px', color:'#aaa', lineHeight:'1.7', background:'#1a1a1a', padding:'12px 14px', borderRadius:'8px', border:'1px solid #222' }}>
                    {showKo && translated[popup.id] ? translated[popup.id].writing_style : popup.writing_style}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#555', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'8px' }}>AI 시스템 프롬프트</div>
                <div style={{ fontSize:'11px', color:'#777', lineHeight:'1.8', background:'#111', padding:'14px 16px', borderRadius:'8px', border:'1px solid #1e1e1e', whiteSpace:'pre-wrap', fontFamily:'monospace' }}>
                  {showKo && translated[popup.id] ? translated[popup.id].system_prompt : (popup.system_prompt || '—')}
                </div>
              </div>

              {/* 글 생성 & 발행 패널 */}
              <div style={{ borderTop:'1px solid #222', paddingTop:'16px' }}>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#1E6AFF', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px' }}>✦ 글 생성 &amp; 발행</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  <input
                    style={inputSt}
                    value={genKw}
                    onChange={e => setGenKw(e.target.value)}
                    placeholder={popup.language === 'en' ? 'e.g. vitamin c serum benefits' : popup.language === 'ko' ? '예: 비타민C 세럼 효과 완벽 정리' : '例: ビタミンC 美容液'}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  />
                  <select style={inputSt} value={genSiteId} onChange={e => setGenSiteId(e.target.value)}>
                    <option value="">— 발행 사이트 선택 —</option>
                    {sites.filter(s => s.language === popup.language).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleGenerate}
                    disabled={genLoading || !genKw.trim() || !genSiteId}
                    style={{ padding:'9px 16px', borderRadius:'7px', cursor:'pointer',
                      background:'#1E6AFF', border:'none', color:'#fff',
                      fontSize:'13px', fontWeight:'700',
                      opacity:(genLoading || !genKw.trim() || !genSiteId) ? 0.5 : 1 }}>
                    {genLoading ? '⏳ 생성 중... (약 30초)' : '✶ 글 생성 & 발행'}
                  </button>
                  {genResult && (
                    <div style={{ padding:'8px 12px', borderRadius:'6px', fontSize:'12px', lineHeight:'1.5',
                      background: genResult.ok ? 'rgba(0,196,113,0.1)' : 'rgba(255,68,68,0.1)',
                      color: genResult.ok ? '#00c471' : '#ff4444',
                      border: `1px solid ${genResult.ok ? 'rgba(0,196,113,0.3)' : 'rgba(255,68,68,0.3)'}` }}>
                      {genResult.msg}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 팝업 하단 버튼 */}
            <div style={{ padding:'14px 24px', borderTop:'1px solid #1e1e1e', display:'flex', gap:'8px' }}>
              <button
                onClick={() => { setForm({...popup}); setEditing(true); setPopup(null) }}
                style={{ flex:1, padding:'9px', borderRadius:'7px', cursor:'pointer',
                  background:'transparent', border:'1px solid #2a2a2a', color:'#888', fontSize:'12px' }}>
                ✏️ 수정
              </button>
              <button onClick={() => setPopup(null)} style={{ flex:2, padding:'9px', borderRadius:'7px', cursor:'pointer',
                background:'#1E6AFF', border:'none', color:'#fff', fontSize:'13px', fontWeight:'700' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ 편집 모달 ══════════ */}
      {editing && (
        <div onClick={() => { setEditing(false); setForm({}) }} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#161616', border:'1px solid #2a2a2a', borderRadius:'14px',
            width:'500px', maxHeight:'85vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #222', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'14px', fontWeight:'700', color:'#fff' }}>
                {form.id ? '✏️ 아이디 수정' : '➕ 새 아이디 추가'}
              </span>
              <button onClick={() => { setEditing(false); setForm({}) }} style={{ background:'transparent', border:'none', color:'#555', fontSize:'18px', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={labelSt}>코드 *</label>
                  <input style={inputSt} value={form.code||''} placeholder="EN-F-01" onChange={e => setForm(f => ({...f, code:e.target.value}))} />
                </div>
                <div>
                  <label style={labelSt}>언어 *</label>
                  <select style={inputSt} value={form.language||'en'} onChange={e => setForm(f => ({...f, language:e.target.value}))}>
                    <option value="en">🇺🇸 English</option>
                    <option value="ko">🇰🇷 한국어</option>
                    <option value="ja">🇯🇵 日本語</option>
                  </select>
                </div>
                <div>
                  <label style={labelSt}>활성</label>
                  <select style={inputSt} value={form.is_active ? 'true':'false'} onChange={e => setForm(f => ({...f, is_active: e.target.value==='true'}))}>
                    <option value="true">✅ 활성</option>
                    <option value="false">⛔ 비활성</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={labelSt}>이름 *</label>
                  <input style={inputSt} value={form.name||''} placeholder="Sarah Mitchell" onChange={e => setForm(f => ({...f, name:e.target.value}))} />
                </div>
                <div>
                  <label style={labelSt}>직함 *</label>
                  <input style={inputSt} value={form.title||''} placeholder="Certified Nutritionist" onChange={e => setForm(f => ({...f, title:e.target.value}))} />
                </div>
              </div>
              <div>
                <label style={labelSt}>담당 카테고리 (쉼표 구분, 최대 5개)</label>
                <input style={inputSt} value={(form.categories||[]).join(', ')} placeholder="health, skin-care, anti-aging"
                  onChange={e => setForm(f => ({...f, categories: e.target.value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,5)}))} />
              </div>
              <div>
                <label style={labelSt}>글쓰기 스타일</label>
                <input style={inputSt} value={form.writing_style||''} placeholder="warm, evidence-based" onChange={e => setForm(f => ({...f, writing_style:e.target.value}))} />
              </div>
              <div>
                <label style={labelSt}>AI 시스템 프롬프트 *</label>
                <textarea value={form.system_prompt||''}
                  onChange={e => setForm(f => ({...f, system_prompt:e.target.value}))}
                  placeholder="You are [name], a [title]..."
                  rows={6}
                  style={{ ...inputSt, resize:'vertical', lineHeight:'1.5' }} />
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid #222', display:'flex', gap:'8px' }}>
              <button onClick={() => { setEditing(false); setForm({}) }} style={{
                flex:1, padding:'9px', borderRadius:'7px', cursor:'pointer',
                background:'transparent', border:'1px solid #2a2a2a', color:'#555', fontSize:'12px' }}>취소</button>
              <button onClick={save} disabled={saving || !form.code || !form.name} style={{
                flex:2, padding:'9px', borderRadius:'7px', cursor:'pointer',
                background:'#1E6AFF', border:'none', color:'#fff',
                fontSize:'13px', fontWeight:'700',
                opacity: (!form.code||!form.name) ? 0.5 : 1 }}>
                {saving ? '저장 중...' : form.id ? '💾 수정 저장' : '✅ 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
