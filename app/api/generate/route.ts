import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { pickPromptByContentType, getCategoryInstruction } from '@/lib/prompts/seo-prompts'
import { generateCardImage } from '@/lib/image/satori-generator'
import {
  publishToWordPress,
  extractMetaFromContent,
  getOrCreateWpCategory,
  uploadImageToWordPress,
  type WordPressSite,
} from '@/lib/wordpress/client'

// Next.js Route Segment Config - 최대 300초(5분) 허용
export const maxDuration = 300
export const dynamic = 'force-dynamic'


/**
 * [Step 2] Claude Haiku로 이미지 캡션 N개 별도 생성
 * 본문 기반으로 짧은 소제목 느낌 문구를 이미지마다 다르게 만들기 위해 분리 호출
 */
async function generateImageCaptions(
  keyword: string,
  contentSnippet: string,
  count: number,
  language: string,
): Promise<string[]> {
  try {
    const langInstr = language === 'ko' ? '반드시 한국어로' : language === 'ja' ? '必ず日本語で' : 'in English'
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `다음 키워드와 본문 앞부분을 참고해서, 이미지 카드에 들어갈 짧은 문구 ${count}개를 ${langInstr} 생성해줘.
각 문구는 10~20자 이내의 핵심 소제목 느낌으로. 파이프(|)로 구분해서 한 줄로만 출력해. 다른 설명 없이.

키워드: "${keyword}"
본문 앞부분: ${contentSnippet}

출력 예시: 핵심 정보 요약|전문가 추천 방법|실천 가이드|주의사항|비용 분석`
      }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const caps = text.split('|').map(s => s.trim()).filter(s => s.length >= 2 && s.length <= 25)
    console.log(`📝 Claude Haiku 캡션 ${caps.length}개 생성:`, caps)
    return caps.length >= 2 ? caps : [keyword]
  } catch (e) {
    console.warn('⚠ 캡션 생성 실패, keyword 폴백:', e)
    return [keyword]
  }
}


/**
 * 발행 전 콘텐츠 정리
 * - [INTERNAL_LINK: ...] 플레이스홀더 제거
 * - HTML 주석 제거
 * 
 * ⚠️ 참고문헌은 하단 섹션 템플릿이 아니라 Claude 프롬프트가 본문 내에 자연스럽게 인용하도록 지시함
 * → 패턴 없음, 글마다 다름, E-E-A-T 연계성 자연스럽게 확보
 */
function cleanContentForPublish(content: string): string {
  return content
    .replace(/\[INTERNAL_LINK:\s*([^\]]+)\]/g, '') // 플레이스홈더 완전 제거
    .replace(/<!--\s*IMG[\s\S]*?-->/g, '')           // IMG*, IMG_CAPS 주석 제거
    .replace(/<!--\s*LSI_KEYWORDS[\s\S]*?-->/g, '') // LSI 키워드 주석 제거
    .replace(/<!--\s*SOCIAL_COPY[\s\S]*?-->/g, '')  // 소셜 커피 주석 제거
    .replace(/\(IMG_CAPS[^)]*\)/g, '')               // IMG_CAPS 형식 안내 줄 제거
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 페르소나별 시스템 프롬프트
const PERSONA_PROMPTS: Record<string, string> = {
  'P-01': 'You are Dr. Sarah Mitchell, a board-certified dermatologist with 15 years of clinical experience. Write professional, evidence-based content with a warm, approachable tone. Always cite scientific principles and practical clinical insights.',
  'P-02': 'You are Jessica Park, a registered nurse and experienced health writer. Write in a conversational, empathetic tone that makes complex health topics easy to understand for everyday readers.',
  'P-03': 'You are Dr. Michael Chen, a nutrition scientist with a PhD. Write evidence-based content about nutrition and supplements, making scientific information accessible without oversimplifying.',
  'P-04': 'You are Emma Rodriguez, a certified esthetician with 10 years of skincare expertise. Write with enthusiasm and practical tips from real salon experience.',
  'P-05': 'You are Dr. Lisa Thompson, a licensed pharmacist. Write with precision and focus on safety, efficacy, and evidence-based information. Always emphasize consulting healthcare providers.',
  'P-06': '당신은 김지은 에디터로, 10년 경력의 뷰티 전문 에디터입니다. 독자 친화적이고 실용적인 뷰티 정보를 제공하며, 한국 뷰티 트렌드에 정통합니다.',
  'P-07': 'あなたは田中美咲、ビューティーコンサルタントです。日本のビューティーとスキンケアに関する専門知識を持ち、親しみやすく実用的な情報を提供します。',
  'P-08': '당신은 박현주 원장으로, 피부과 전문의입니다. 의학적 근거에 기반한 정확한 정보를 제공하며, 환자들이 올바른 결정을 내릴 수 있도록 돕습니다.',
}

// 고정 SEO 요구사항 (항상 포함) - WordPress HTML 호환
const FIXED_SEO_REQUIREMENTS = `
[고정 SEO 요구사항 - 반드시 모두 포함, WordPress REST API 업로드용 HTML]

1. 메타 주석 (본문 최상단):
<!-- META: [키워드 자연 포함, 독자 혜택 명확, 150자 이하 메타디스크립션] -->
<!-- TITLE: [H1 제목 - 키워드+숫자+연도 조합, 50~60자] -->

2. HTML 구조 (WordPress 에디터 호환):
- <h1>: 키워드 포함, 본문에 단 1개
- <h2>: 주요 섹션 구분, 각 소제목에 LSI 키워드 자연 포함
- <h3>: 세부 항목
- <p>: 2~3문장 단락 (가독성)
- <ul>/<ol>: 목록형 정보
- <strong>: 핵심 키워드/수치 강조 (남용 금지, 단락당 1~2개)
- <blockquote>: 전문가 인용 또는 핵심 포인트

3. 키워드 배치 규칙:
- 주 키워드: H1, 첫 단락, 마지막 단락에 자연 포함
- LSI 키워드 5개 이상 본문 전체에 분산 (같은 단락에 몰리지 않게)
- 키워드 밀도 1~2% (기계적 반복 금지 - 구글 AI 감지 회피)

4. Schema Markup 힌트 주석 (본문 상단):
<!-- SCHEMA: Article | FAQPage | HowTo -->

5. E-E-A-T 신호 (반드시 포함):
- 구체적 수치/연구 언급 ("2023년 연구에 따르면", "X명 대상 임상에서")
- 전문적 표현과 일상 언어 혼합 (인간 필자처럼)
- 개인적 관점 또는 경험 서술 어조 1~2곳

6. 내부 링크 플레이스홀더:
[INTERNAL_LINK: 관련 주제명] 형식으로 글 내 2~3곳 삽입

7. 의료/건강 면책 조항 (본문 맨 아래):
<p class="disclaimer"><strong>⚠️ 면책 조항:</strong> 이 글은 정보 제공 목적으로 작성되었으며, 전문적인 의료 조언을 대체하지 않습니다. 개인 건강 상태에 따라 의사 또는 전문가와 상담하세요.</p>

8. 자연스러운 글쓰기 패턴 (AI 감지 회피):
- 문장 길이를 의도적으로 다양하게 (짧은 문장 + 긴 문장 혼합)
- 구어체 표현 1~2곳 자연스럽게 삽입
- 동일 표현 반복 금지 (유의어 활용)
`

// 랜덤 SEO 옵션 - 각 옵션이 실제 HTML 구조를 출력하도록 상세 지시
const RANDOM_SEO_OPTIONS: Array<{ label: string; instruction: string }> = [
  {
    label: '권위 출처 인용',
    instruction: `
[본문 내 권위 있는 출처 자연스럽게 인용 - E-E-A-T 신뢰도 신호]
글을 작성할 때 본문 내에 1~3개의 출처 언급을 자연스럽게 삽입하세요.
- 출처는 하단 별도 섹션이 아니라 해당 근거가 나오는 문장 바로 그 자리에 녹여넣기
- 형식: "○○ 연구(출처 기관명)에 따르면", "○○ 기관의 가이드라인에서는", "○○ 학회지에 게재된 논문에 의하면"
- 언어에 맞는 출처 사용:
  - 한국어: 식품의약품안전처, 대한피부과학회, 질병관리청, 대한의사협회, 한국소비자원 등
  - 영어: NIH, FDA, WHO, American Academy of Dermatology, PubMed, JAMA, NEJM 등
  - 일본어: 厚生労働省, 日本皮膚科学会, 消費者庁, 国立健康・栄養研究所 등
- 카테고리에 맞는 기관 선택 (피부과 관련→피부과학회, 영양→영양학회 등)
- 출처 명시가 문장 흐름을 어색하게 만들지 않도록 자연스럽게 삽입
- 연도를 함께 표기하면 신뢰도 증가: "2023년 NIH 연구에 따르면"`,
  },
  {
    label: 'FAQ 섹션',
    instruction: `
[FAQ 섹션 - 본문 하단 삽입, Schema FAQPage 호환 HTML]
다음 형식으로 자주 묻는 질문 5개를 작성하세요:
<section class="faq-section">
  <h2>자주 묻는 질문 (FAQ)</h2>
  <!-- SCHEMA: FAQPage -->
  <div class="faq-item">
    <h3>Q. [실제 독자가 검색할 법한 구체적 질문]?</h3>
    <p>[첫 문장에 직접 답변 + 2~3문장 상세 설명. 키워드 자연 포함]</p>
  </div>
  [위 패턴으로 총 5개 작성]
</section>
- 질문은 People Also Ask 스타일 (언제, 어떻게, 왜, 얼마나, 어떤)
- 각 답변 첫 문장에 Featured Snippet 최적화 직접 답변 포함`,
  },
  {
    label: '비교표',
    instruction: `
[비교표 섹션 - HTML table 태그 사용]
다음 형식으로 핵심 선택지 비교표를 작성하세요:
<section class="comparison-table">
  <h2>[주제] 한눈에 비교</h2>
  <table>
    <thead>
      <tr><th>구분</th><th>[옵션A]</th><th>[옵션B]</th><th>[옵션C]</th></tr>
    </thead>
    <tbody>
      <tr><td>효과</td><td>...</td><td>...</td><td>...</td></tr>
      <tr><td>비용</td><td>...</td><td>...</td><td>...</td></tr>
      <tr><td>부작용</td><td>...</td><td>...</td><td>...</td></tr>
      <tr><td>추천 대상</td><td>...</td><td>...</td><td>...</td></tr>
      <tr><td>사용 편의성</td><td>...</td><td>...</td><td>...</td></tr>
    </tbody>
  </table>
  <p><strong>결론:</strong> [어떤 상황에 무엇을 선택할지 1~2문장 요약]</p>
</section>`,
  },
  {
    label: '체크리스트',
    instruction: `
[체크리스트 섹션 - 독자 자가진단/실행 체크리스트]
다음 형식으로 작성하세요:
<section class="checklist-section">
  <h2>✅ [주제] 체크리스트</h2>
  <p>아래 항목을 확인해 보세요. 해당 항목이 많을수록 [행동 필요성] 높습니다.</p>
  <ul class="checklist">
    <li>☐ [구체적 확인 항목 - 독자가 yes/no 답할 수 있는 것]</li>
    [10개 항목 작성]
  </ul>
  <p><strong>7개 이상:</strong> [권고 행동]. <strong>4~6개:</strong> [권고 행동]. <strong>3개 이하:</strong> [권고 행동]</p>
</section>`,
  },
  {
    label: '작성자 바이오',
    instruction: `
[작성자 바이오 섹션 - E-E-A-T 신호, 본문 맨 아래 면책 조항 직전]
다음 형식으로 작성하세요 (페르소나 정보 기반):
<section class="author-bio">
  <h3>이 글을 쓴 전문가</h3>
  <!-- IMG ALT: "전문가 프로필 사진 - [전문 분야] 전문가" -->
  <div class="author-info">
    <p><strong>[전문가 이름], [자격/직함]</strong></p>
    <p>[전문 분야, 경력 연수, 주요 실적을 2~3문장으로. 신뢰성 있게 구체적으로 작성]</p>
    <p>전문 분야: [키워드 관련 전문 영역 나열]</p>
  </div>
</section>`,
  },
  {
    label: '이미지 alt text 제안',
    instruction: `
[이미지 배치 제안 - 본문 내 적절한 위치에 주석 삽입]
글의 논리 흐름에 맞게 5곳에 이미지 제안 주석을 삽입하세요:
<!-- IMG: [이미지 설명] | ALT: "[주 키워드 포함 alt text, 20자 이내]" | TYPE: [infographic|photo|chart|diagram] -->
- 각 이미지는 해당 단락 내용을 시각적으로 보완
- alt text는 키워드를 자연스럽게 포함 (스크린리더 기준으로 의미 있게)
- 예: <!-- IMG: 레티놀 적용 전후 6주 변화 | ALT: "레티놀 효과 before after 6주" | TYPE: photo -->`,
  },
  {
    label: '소셜 공유 문구',
    instruction: `
[소셜 미디어 공유 최적화 섹션 - 본문 하단]
다음 형식으로 작성하세요:
<section class="social-share">
  <h3>이 정보가 도움이 되셨나요? 공유해 주세요</h3>
  <!-- SOCIAL_COPY -->
  <!-- 인스타그램: [이모지 포함, 해시태그 5개, 150자 이내 공유 문구] -->
  <!-- 트위터/X: [핵심 인사이트 1문장 + 단축 URL 자리 + 해시태그 2개, 280자 이내] -->
  <!-- 카카오/라인: [친근한 어조, 클릭 유도, 200자 이내] -->
</section>`,
  },
  {
    label: '관련 키워드 섹션',
    instruction: `
[관련 키워드 및 LSI 섹션 - 본문 맨 아래, 면책 조항 직전]
다음 형식으로 작성하세요:
<section class="related-topics">
  <h3>관련 주제 더 알아보기</h3>
  <ul>
    <li>[INTERNAL_LINK: 관련 주제1] — [한 줄 설명]</li>
    <li>[INTERNAL_LINK: 관련 주제2] — [한 줄 설명]</li>
    <li>[INTERNAL_LINK: 관련 주제3] — [한 줄 설명]</li>
  </ul>
  <!-- LSI_KEYWORDS: [본문에 자연스럽게 포함된 LSI 키워드 10개 콤마 구분 나열] -->
</section>`,
  },
  {
    label: '독자 CTA',
    instruction: `
[독자 행동 유도(CTA) 섹션 - 결론 직후 삽입]
다음 형식으로 2가지 CTA를 작성하세요:
<section class="cta-section">
  <div class="cta-primary">
    <h3>🎯 지금 바로 시작하세요</h3>
    <p>[독자가 즉시 취할 수 있는 첫 번째 구체적 행동 - 부담 없이 따라할 수 있게]</p>
    <p><strong>오늘의 실천 포인트:</strong> [매우 구체적인 한 가지 행동]</p>
  </div>
  <div class="cta-secondary">
    <h3>💬 경험을 공유해 주세요</h3>
    <p>[독자 참여 유도 문구 - 댓글, 경험 공유 등. 친근하고 구체적으로]</p>
  </div>
</section>`,
  },
]

function pickRandomSeoOptions(count = 3): Array<{ label: string; instruction: string }> {
  const shuffled = [...RANDOM_SEO_OPTIONS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

interface SeoDefaults {
  minWords?: number
  maxWords?: number
  keywordDensity?: string
  includeSchema?: boolean
  includeFaq?: boolean
  includeDisclaimer?: boolean
  defaultLang?: string
  defaultContentType?: string
}

function buildDynamicSeoRequirements(seo: SeoDefaults): string {
  const density = seo.keywordDensity ?? '1.5'
  const schemaLine = seo.includeSchema !== false
    ? `\n4. Schema Markup 힌트 주석 (본문 상단):\n<!-- SCHEMA: Article | FAQPage | HowTo -->`
    : ''
  const disclaimerLine = seo.includeDisclaimer !== false
    ? `\n7. 의료/건강 면책 조항 (본문 맨 아래):\n<p class="disclaimer"><strong>⚠️ 면책 조항:</strong> 이 글은 정보 제공 목적으로 작성되었으며, 전문적인 의료 조언을 대체하지 않습니다. 개인 건강 상태에 따라 의사 또는 전문가와 상담하세요.</p>`
    : ''

  return `
[고정 SEO 요구사항 - 반드시 모두 포함, WordPress REST API 업로드용 HTML]

1. 메타 주석 (본문 최상단):
<!-- META: [키워드 자연 포함, 독자 혜택 명확, 150자 이하 메타디스크립션] -->
<!-- TITLE: [H1 제목 - 키워드+숫자+연도 조합, 50~60자] -->

2. HTML 구조 (WordPress 에디터 호환):
- <h1>: 키워드 포함, 본문에 단 1개
- <h2>: 주요 섹션 구분, 각 소제목에 LSI 키워드 자연 포함
- <h3>: 세부 항목
- <p>: 2~3문장 단락 (가독성)
- <ul>/<ol>: 목록형 정보
- <strong>: 핵심 키워드/수치 강조 (남용 금지, 단락당 1~2개)
- <blockquote>: 전문가 인용 또는 핵심 포인트

3. 키워드 배치 규칙:
- 주 키워드: H1, 첫 단락, 마지막 단락에 자연 포함
- LSI 키워드 5개 이상 본문 전체에 분산 (같은 단락에 몰리지 않게)
- 키워드 밀도 ${density}% (기계적 반복 금지 - 구글 AI 감지 회피)
${schemaLine}

5. E-E-A-T 신호 (반드시 포함):
- 구체적 수치/연구 언급 ("2023년 연구에 따르면", "X명 대상 임상에서")
- 전문적 표현과 일상 언어 혼합 (인간 필자처럼)
- 개인적 관점 또는 경험 서술 어조 1~2곳

6. 내부 링크 플레이스홀더:
[INTERNAL_LINK: 관련 주제명] 형식으로 글 내 2~3곳 삽입
${disclaimerLine}

8. 자연스러운 글쓰기 패턴 (AI 감지 회피):
- 문장 길이를 의도적으로 다양하게 (짧은 문장 + 긴 문장 혼합)
- 구어체 표현 1~2곳 자연스럽게 삽입
- 동일 표현 반복 금지 (유의어 활용)
`
}

function buildPrompt(params: {
  keyword: string
  language: string
  contentType: string
  category: string
  wordCount: number
  seoPromptStructure: string
  randomSeoOptions: Array<{ label: string; instruction: string }>
  seoDefaults?: SeoDefaults
}): string {
  const { keyword, language, category, wordCount, seoPromptStructure, randomSeoOptions, seoDefaults } = params
  const dynamicSeoReqs = buildDynamicSeoRequirements(seoDefaults ?? {})

  const langInstruction =
    language === 'ko' ? '반드시 한국어로 작성하세요. 영어 키워드가 주어져도 한국어 글을 작성하세요.' :
    language === 'ja' ? '必ず日本語で書いてください。英語キーワードが与えられても日本語で書いてください。' :
    'Write in English only.'

  const randomOptionBlocks = randomSeoOptions
    .map((o, i) => `[랜덤 SEO 옵션 ${i + 1}: ${o.label}]${o.instruction}`)
    .join('\n\n')

  return `${langInstruction}

키워드: "${keyword}"
카테고리: ${category || 'General Health & Beauty'}
목표 글자 수: ${wordCount}자 이상

${seoPromptStructure}

${dynamicSeoReqs}

━━━ 이번 글에 반드시 포함할 랜덤 SEO 섹션 (아래 3가지 모두 실제 HTML로 작성) ━━━
${randomOptionBlocks}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OUTPUT FORMAT (코드블록 없이 HTML만 출력):
<!-- META: [150자 이하 메타디스크립션 - 키워드 포함, 클릭 유도] -->
<!-- TITLE: [H1 제목] -->
<!-- PROMPT_ID: [사용된 프롬프트 ID] -->
<!-- SCHEMA: Article | FAQPage -->
<!-- IMG_CAPS: [캡션1]|[캡션2]|[캡션3]|[캡션4]|[캡션5]|[캡션6]|[캡션7]|[캡션8] -->
(IMG_CAPS 형식: 각 캡션은 본문의 주요 소제목/핵심 개념을 뽑은 10자 내외 짧은 구문. 파이프(|)로 구분. 예: 수염제모 트렌드|연령별 선호도|레이저 vs 왁싱|비용 비교|부작용 주의)

⚠️ 중요: 글은 반드시 결론 섹션(마무리/정리/요약)으로 완전히 끝나야 합니다. 내용이 중간에 잘리지 않도록 하고, 마지막에 면책 조항까지 포함하여 완결된 글을 작성하세요.

[<h1>으로 시작하는 전체 HTML 본문 - 위 랜덤 섹션 포함 — 반드시 결론/마무리 단락으로 완결]`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      keyword, language, category, contentType,
      sitePersonas,   // 사이트별 페르소나 맵 { siteId: personaCode }
      personaCode,    // 단일 페르소나 (fallback)
      wordCount, siteIds, scheduleType, scheduleDate,
      scheduledDates, // 달력에서 선택된 날짜 배열 ['2025-03-10', ...]
      publishNow,     // 즉시 WordPress 발행 여부
      generateImage,  // 이미지 자동 생성 여부 (설정 페이지 / 클라이언트 전달)
      imageCount,     // '염'|'1'~'5' : 글당 생성할 이미지 수
      imageCountMin,  // 랜덤일 때 최소
      imageCountMax,  // 랜덤일 때 최대
      seoDefaults,    // 설정 페이지 SEO 기본값 (localStorage → 클라이언트 전달)
    } = body

    if (!keyword?.trim()) {
      return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 })
    }
    if (!siteIds || siteIds.length === 0) {
      return NextResponse.json({ error: '발행할 사이트를 선택해주세요.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 사이트 정보 조회 (WordPress 발행에 필요)
    const { data: sitesData } = await supabase
      .from('sites')
      .select('*')
      .in('id', siteIds)

    const sitesMap = new Map<string, WordPressSite>(
      (sitesData || []).map(s => [s.id, s as WordPressSite])
    )

    // ── 페르소나 system_prompt Supabase에서 로드 (KR 페르소나 등 모든 코드 지원) ──
    const allPersonaCodes = [...new Set([
      ...Object.values(sitePersonas ?? {}) as string[],
      personaCode,
    ].filter(Boolean))]

    const { data: personasData } = await supabase
      .from('personas')
      .select('code, system_prompt, writing_style, name, title')
      .in('code', allPersonaCodes.length ? allPersonaCodes : ['P-01'])

    const personaMap = new Map<string, { system_prompt: string; writing_style: string; name: string; title: string }>(
      (personasData || []).map(p => [p.code, p])
    )
    console.log(`👥 페르소나 로드: ${personasData?.map(p => p.code).join(', ') || '없음'}`)

    // ── 사이트별 결과 추적 변수 ──
    const results: Array<{
      siteId: string
      promptId: string
      personaCode: string
      wpResult?: { success: boolean; postUrl?: string; postId?: number; error?: string }
    }> = []
    const logInserts: Array<Record<string, unknown>> = []

    let lastContent = ''
    let lastSeoTemplate = { id: '', name: '', style: '' }
    let lastRandomSeoOptions: Array<{ label: string; instruction: string }> = []
    let lastTokens = { input: 0, output: 0 }

    for (const siteId of siteIds) {
      // 사이트별 페르소나 결정
      const sitePersonaCode = (sitePersonas?.[siteId]) || personaCode || 'P-01'
      // Supabase 페르소나 우선, 없으면 하드코딩 폴백
      const personaData = personaMap.get(sitePersonaCode)
      const systemPrompt = personaData?.system_prompt
        || PERSONA_PROMPTS[sitePersonaCode]
        || PERSONA_PROMPTS['P-01']
      if (personaData) {
        console.log(`🎭 페르소나: ${personaData.name} (${sitePersonaCode}) — ${personaData.title}`)
      }

      // 사이트별 랜덤 SEO 프롬프트 선택 (다양성 확보)
      const seoPromptTemplate = pickPromptByContentType(contentType)
      const randomSeoOptions = pickRandomSeoOptions(3)

      // wordCount 결정: seoDefaults.minWords ~ maxWords 범위에서 랜덤, 또는 직접 전달값
      const effectiveWordCount = wordCount
        || (seoDefaults?.minWords && seoDefaults?.maxWords
            ? seoDefaults.minWords + Math.floor(Math.random() * (seoDefaults.maxWords - seoDefaults.minWords))
            : seoDefaults?.minWords
            ? seoDefaults.minWords
            : 1500)

      const userPrompt = buildPrompt({
        keyword, language, contentType, category,
        wordCount: effectiveWordCount,
        seoPromptStructure: `[글쓰기 스타일: ${seoPromptTemplate.name} (${seoPromptTemplate.id})]\n${seoPromptTemplate.contentStructure}`,
        randomSeoOptions,
        seoDefaults: seoDefaults ?? {},
      })

      // Claude API 호출 (페르소나 + SEO 스타일 + 카테고리 전문성 3중 조합)
      const categoryInstruction = getCategoryInstruction(category || 'health')
      const combinedSystem = [systemPrompt, seoPromptTemplate.systemInstruction, categoryInstruction]
        .filter(Boolean)
        .join('\n\n---\n\n')

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
        system: combinedSystem,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const content = message.content[0].type === 'text' ? message.content[0].text : ''
      const inputTokens = message.usage.input_tokens
      const outputTokens = message.usage.output_tokens

      // 실제 글자 수 (HTML 태그 및 공백 제거 후)
      const actualWordCount = content.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, '').length
      // 발행 전 정리된 콘텐츠
      const cleanedContent = cleanContentForPublish(content)

      lastContent = cleanedContent
      lastSeoTemplate = { id: seoPromptTemplate.id, name: seoPromptTemplate.name, style: seoPromptTemplate.style }
      lastRandomSeoOptions = randomSeoOptions
      lastTokens = { input: inputTokens, output: outputTokens }

      // 메타 정보 추출 (제목, 메타 디스크립션)
      const { title: extractedTitle, metaDescription } = extractMetaFromContent(cleanedContent)
      const finalTitle = extractedTitle || `[${seoPromptTemplate.id}] ${keyword}`

      // ── 이미지 카드 문구: Claude가 출력한 IMG_CAPS 파싱 (가장 확실한 방법) ──
      const capMatch = content.match(/<!--\s*IMG_CAPS:\s*(.*?)\s*-->/)
      const parsedCaps = capMatch
        ? capMatch[1].split('|').map(s => s.trim()).filter(s => s.length >= 2 && !s.startsWith('['))
        : []
      // 폴백: H2 추출
      const h2Fallback = parsedCaps.length < 3
        ? (cleanedContent.match(/<h2[^>]*>([\.\s\S]*?)<\/h2>/gi) || [])
            .map(h => h.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z0-9#]+;/g, ' ').trim())
            .filter(t => t.length >= 4)
        : []
      const allCaps = [...parsedCaps, ...h2Fallback]
      const imageSubtitles: string[] = []
      for (let k = 0; k < 8; k++) {
        const cap = allCaps[k] ?? keyword
        imageSubtitles.push(cap.length > 20 ? cap.slice(0, 20) + '…' : cap)
      }
      console.log(`📝 이미지 캡션 ${parsedCaps.length}개 (IMG_CAPS) + H2폴백 ${h2Fallback.length}개:`, imageSubtitles)

      // 사이트별 이미지 업로드 수 추적
      let actualImageCount = 0

      // ── 이미지 먼저 생성·업로드, 콘텐츠에 삽입 후 한번에 발행 ──
      let wpResult: { success: boolean; postUrl?: string; postId?: number; error?: string } | undefined

      if (publishNow && scheduleType === 'immediate') {
        const site = sitesMap.get(siteId)
        if (site && site.wp_url && site.wp_username && site.wp_app_password) {

          // ── Step 1: 이미지 생성 & 미디어 업로드 (발행 전) ──
          const mediaItems: Array<{ id: number; url: string }> = []
          if (generateImage) {
            try {
              const cardCategory = (category || site.category || 'health') as string
              const cardLang     = (language || 'ko') as 'ko' | 'en' | 'ja'

              // ── 이미지 개수: 설정값 적용 ──
              let numImages: number
              if (imageCount === 'fixed') {
                numImages = Math.max(1, imageCountMin || 1)
              } else {
                // 랜덤: min~max 사이
                const min = Math.max(1, imageCountMin || 1)
                const max = Math.min(8, imageCountMax || 8)
                numImages = min + Math.floor(Math.random() * (max - min + 1))
              }
              console.log(`📸 이미지 ${numImages}개 생성 예정 (설정: ${imageCount}, ${imageCountMin}~${imageCountMax})`)

              // Fisher-Yates 셔플로 레이아웃 균등 랜덤 배정
              const layoutPool = [0,1,2,3,4,5,6,7,8,9,10]
              for (let k = layoutPool.length - 1; k > 0; k--) {
                const j = Math.floor(Math.random() * (k + 1));
                [layoutPool[k], layoutPool[j]] = [layoutPool[j], layoutPool[k]]
              }

              for (let i = 0; i < numImages; i++) {
                try {
                  // 이미지별 소제목을 메인 제목으로, 나머지 소제목을 캡션으로 사용
                  const imgTitle = imageSubtitles[i] ?? finalTitle
                  const imgCaptions = imageSubtitles.filter((_, idx) => idx !== i).slice(0, 5)
                  if (imgCaptions.length === 0) imgCaptions.push(keyword)

                  const imgData = {
                    title:    imgTitle,
                    captions: imgCaptions,
                    category: cardCategory,
                    language: cardLang,
                    layout:   layoutPool[i % layoutPool.length],
                    variant:  i,
                    siteName: site.name,
                  }
                  console.log(`🎨 이미지 ${i + 1}: layout=${imgData.layout}, title="${imgTitle.slice(0,15)}"`)
                   const imgBuffer = await generateCardImage(imgData)
                  const slug      = finalTitle.replace(/[^a-zA-Z0-9가-힣]/g, '-').slice(0, 40)
                  const filename  = `card-${slug}-v${i + 1}-${Date.now()}.png`
                  // alt text = 이미지별 소제목 (SEO 최적화)
                  const altText   = `${imgTitle} - ${keyword}`
                  const media     = await uploadImageToWordPress(site, imgBuffer, filename, altText)
                  if (media) {
                    mediaItems.push(media)
                    console.log(`✅ 이미지 ${i + 1}/${numImages} 업로드 완료 (id: ${media.id})`)
                  } else {
                    console.warn(`⚠️ 이미지 ${i + 1}/${numImages} 업로드 실패 (null 반환)`)
                  }
                } catch (singleImgErr) {
                  console.warn(`⚠️ 이미지 ${i + 1}/${numImages} 생성/업로드 오류:`, singleImgErr)
                }
              }
              console.log(`✅ 이미지 ${mediaItems.length}개 미리 업로드 완료`)
            } catch (imgErr) {
              console.warn('이미지 사전 생성 실패, 이미지 없이 발행:', imgErr)
            }
          }

          // ── Step 2: 나머지 이미지들을 H2 뒤에 콘텐츠에 직접 삽입 (실제 URL 사용) ──
          let finalContent = cleanedContent
          if (mediaItems.length > 1) {
            const imgTags  = mediaItems.slice(1).map((media, idx) =>
              `\n<figure class="wp-block-image size-full"><img src="${media.url}" alt="${finalTitle} 이미지 ${idx + 2}" /></figure>\n`
            )
            const h2Regex     = /<\/h2>/gi
            const h2Positions: number[] = []
            let h2Match
            while ((h2Match = h2Regex.exec(finalContent)) !== null) {
              h2Positions.push(h2Match.index + h2Match[0].length)
            }
            if (h2Positions.length > 0) {
              const chosen = h2Positions
                .sort(() => Math.random() - 0.5)
                .slice(0, imgTags.length)
                .sort((a, b) => b - a)  // 역순으로 삽입해야 위치 밀림 없음
              chosen.forEach((pos, idx) => {
                finalContent = finalContent.slice(0, pos) + imgTags[idx] + finalContent.slice(pos)
              })
              console.log(`✅ 본문에 이미지 ${imgTags.length}개 삽입 완료`)
            }
          }
          actualImageCount = mediaItems.length

          // ── Step 3: WP 카테고리 처리 ──
          let wpCategoryIds: number[] | undefined
          if (category) {
            const catId = await getOrCreateWpCategory(site, category)
            if (catId) wpCategoryIds = [catId]
          }

          // ── Step 4: 이미지 포함된 콘텐츠 한번에 발행 + 대표 이미지 지정 ──
          const wpPublishResult = await publishToWordPress(site, {
            title:           finalTitle,
            content:         finalContent,   // ← 이미지 이미 삽입된 버전
            metaDescription,
            status:          'publish',
            categories:      wpCategoryIds,
            featuredMediaId: mediaItems[0]?.id,  // ← 첫 번째 이미지 = 대표 이미지 동시 설정
          })

          wpResult = {
            success: wpPublishResult.success,
            postUrl: wpPublishResult.postUrl,
            postId:  wpPublishResult.postId,
            error:   wpPublishResult.error,
          }
          if (wpPublishResult.success) {
            console.log(`✅ 글+이미지 한번에 발행 완료: ${wpPublishResult.postUrl}`)
          }
        }
      }

      results.push({
        siteId,
        promptId:    seoPromptTemplate.id,
        personaCode: sitePersonaCode,
        wpResult,
      })

      // 예약 날짜 처리
      const dates: string[] = scheduledDates?.length
        ? scheduledDates
        : [scheduleType === 'scheduled' && scheduleDate ? scheduleDate : new Date().toISOString()]

      for (const dateStr of dates) {
        const isImmediate = scheduleType === 'immediate'
        const wasPublished = wpResult?.success && isImmediate

        logInserts.push({
          site_id:          siteId,
          keyword_text:     keyword,
          title:            wpResult?.success ? finalTitle : `[${seoPromptTemplate.id}] ${keyword}`,
          language,
          category:         category || 'general',
          word_count:       actualWordCount,
          image_count:      actualImageCount,
          prompt_type:      seoPromptTemplate.id,
          scheduled_at:     new Date(dateStr).toISOString(),
          status:           wasPublished ? 'published'
                          : scheduledDates?.length ? 'scheduled'
                          : isImmediate ? 'pending'
                          : 'scheduled',
          claude_tokens:    inputTokens + outputTokens,
          // 콘텐츠 저장 (Cron/수동 발행용)
          content:           cleanedContent,
          meta_description:  metaDescription || null,
          prompt_used:       JSON.stringify({ id: seoPromptTemplate.id, name: seoPromptTemplate.name }),
          // WP 발행 결과
          wp_post_id:       wpResult?.postId  || null,
          wp_post_url:      wpResult?.postUrl || null,
          published_at:     wasPublished ? new Date().toISOString() : null,
          error_message:    wpResult?.error  || null,
        })
      }
    }

    // Supabase 로그 저장 (ID 반환)
    const { data: insertedLogs, error: logError } = await supabase.from('publish_logs').insert(logInserts).select('id')
    if (logError) console.warn('로그 저장 실패:', logError.message)

    // 첫 번째 저장된 로그 ID (미리보기 후 발행에 사용)
    const firstLogId = insertedLogs?.[0]?.id || null

    // WP 발행 결과 요약
    const wpSummary = results
      .filter(r => r.wpResult)
      .map(r => ({
        siteId:  r.siteId,
        success: r.wpResult!.success,
        postUrl: r.wpResult!.postUrl,
        error:   r.wpResult!.error,
      }))

    return NextResponse.json({
      content: lastContent,
      promptUsed: lastSeoTemplate,
      randomSeoOptions: lastRandomSeoOptions.map(o => o.label),
      siteResults: results,
      scheduledCount: logInserts.length,
      tokens: {
        input:  lastTokens.input,
        output: lastTokens.output,
        total:  lastTokens.input + lastTokens.output,
      },
      logSaved: !logError,
      wpPublished: wpSummary,
      logId: firstLogId,  // 미리보기 후 발행 시 사용
    })

  } catch (error: unknown) {
    console.error('Generate API error:', error)
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
