/**
 * SEO 참고문헌 DB
 * 언어·카테고리별 신뢰할 수 있는 기관/학술지 목록
 * 글 발행 시 1~3개 랜덤으로 선택해 하단에 참고문헌 섹션으로 추가
 */

export interface Reference {
  name: string        // 기관명 또는 저널명
  url: string         // 공식 URL
  type: 'institution' | 'journal' | 'government' | 'database'
  lang: 'ko' | 'en' | 'ja' | 'all'
  categories: string[]  // 해당하는 카테고리 (빈 배열 = 모든 카테고리)
}

// ─── 한국어 출처 ───────────────────────────────────────────────
const KO_REFERENCES: Reference[] = [
  // 정부·공공기관
  { name: '식품의약품안전처 (MFDS)', url: 'https://www.mfds.go.kr', type: 'government', lang: 'ko', categories: [] },
  { name: '질병관리청 (KDCA)', url: 'https://www.kdca.go.kr', type: 'government', lang: 'ko', categories: ['health', 'medical-procedure', 'mental-health', 'cancer-prevention'] },
  { name: '보건복지부', url: 'https://www.mohw.go.kr', type: 'government', lang: 'ko', categories: ['health', 'supplements', 'diet-clinic'] },
  { name: '국민건강보험공단', url: 'https://www.nhis.or.kr', type: 'government', lang: 'ko', categories: ['health', 'anti-aging', 'lifestyle'] },
  // 학회
  { name: '대한피부과학회', url: 'https://www.derma.or.kr', type: 'institution', lang: 'ko', categories: ['skin-care', 'beauty', 'anti-aging', 'medical-procedure'] },
  { name: '대한의사협회 (KMA)', url: 'https://www.kma.org', type: 'institution', lang: 'ko', categories: ['health', 'medical-procedure', 'cancer-prevention', 'mental-health'] },
  { name: '대한영양사협회', url: 'https://www.dietitian.or.kr', type: 'institution', lang: 'ko', categories: ['supplements', 'functional-food', 'diet-clinic', 'health'] },
  { name: '대한치과의사협회', url: 'https://www.kda.or.kr', type: 'institution', lang: 'ko', categories: ['dental'] },
  { name: '한국소비자원', url: 'https://www.kca.go.kr', type: 'government', lang: 'ko', categories: ['beauty', 'supplements', 'functional-food'] },
  // 저널
  { name: '대한피부과학회지', url: 'https://anndermatol.org', type: 'journal', lang: 'ko', categories: ['skin-care', 'beauty', 'anti-aging', 'medical-procedure'] },
  { name: '한국영양학회지 (Journal of Nutrition and Health)', url: 'https://www.e-jnh.org', type: 'journal', lang: 'ko', categories: ['supplements', 'functional-food', 'diet-clinic'] },
  { name: '한국정신과학회지', url: 'https://www.jknpa.org', type: 'journal', lang: 'ko', categories: ['mental-health'] },
]

// ─── 영어 출처 ─────────────────────────────────────────────────
const EN_REFERENCES: Reference[] = [
  // 정부·공공기관
  { name: 'National Institutes of Health (NIH)', url: 'https://www.nih.gov', type: 'government', lang: 'en', categories: [] },
  { name: 'U.S. Food & Drug Administration (FDA)', url: 'https://www.fda.gov', type: 'government', lang: 'en', categories: ['supplements', 'functional-food', 'skin-care', 'beauty'] },
  { name: 'World Health Organization (WHO)', url: 'https://www.who.int', type: 'government', lang: 'en', categories: ['health', 'cancer-prevention', 'mental-health', 'lifestyle'] },
  { name: 'Centers for Disease Control and Prevention (CDC)', url: 'https://www.cdc.gov', type: 'government', lang: 'en', categories: ['health', 'cancer-prevention', 'mental-health'] },
  { name: 'American Academy of Dermatology (AAD)', url: 'https://www.aad.org', type: 'institution', lang: 'en', categories: ['skin-care', 'beauty', 'anti-aging', 'medical-procedure'] },
  // 데이터베이스
  { name: 'PubMed (National Library of Medicine)', url: 'https://pubmed.ncbi.nlm.nih.gov', type: 'database', lang: 'en', categories: [] },
  // 학술지
  { name: 'Journal of the American Academy of Dermatology (JAAD)', url: 'https://www.jaad.org', type: 'journal', lang: 'en', categories: ['skin-care', 'beauty', 'anti-aging', 'medical-procedure'] },
  { name: 'Journal of Clinical and Aesthetic Dermatology', url: 'https://jcadonline.com', type: 'journal', lang: 'en', categories: ['skin-care', 'beauty', 'anti-aging'] },
  { name: 'Journal of Investigative Dermatology', url: 'https://www.jidonline.org', type: 'journal', lang: 'en', categories: ['skin-care', 'anti-aging', 'medical-procedure'] },
  { name: 'Nutrients (MDPI)', url: 'https://www.mdpi.com/journal/nutrients', type: 'journal', lang: 'en', categories: ['supplements', 'functional-food', 'diet-clinic', 'health'] },
  { name: 'New England Journal of Medicine (NEJM)', url: 'https://www.nejm.org', type: 'journal', lang: 'en', categories: ['health', 'medical-procedure', 'cancer-prevention'] },
  { name: 'American Journal of Clinical Nutrition', url: 'https://www.ajcn.org', type: 'journal', lang: 'en', categories: ['supplements', 'functional-food', 'diet-clinic'] },
  { name: 'Journal of Dental Research', url: 'https://journals.sagepub.com/home/jdr', type: 'journal', lang: 'en', categories: ['dental'] },
  { name: 'JAMA Psychiatry', url: 'https://jamanetwork.com/journals/jamapsychiatry', type: 'journal', lang: 'en', categories: ['mental-health'] },
]

// ─── 일본어 출처 ───────────────────────────────────────────────
const JA_REFERENCES: Reference[] = [
  // 정부·공공기관
  { name: '厚生労働省 (Ministry of Health, Labour and Welfare)', url: 'https://www.mhlw.go.jp', type: 'government', lang: 'ja', categories: [] },
  { name: '消費者庁 (Consumer Affairs Agency)', url: 'https://www.caa.go.jp', type: 'government', lang: 'ja', categories: ['supplements', 'functional-food', 'beauty'] },
  { name: '国立健康・栄養研究所', url: 'https://www.nibiohn.go.jp', type: 'institution', lang: 'ja', categories: ['supplements', 'functional-food', 'health', 'diet-clinic'] },
  { name: '農林水産省 (Ministry of Agriculture, Forestry and Fisheries)', url: 'https://www.maff.go.jp', type: 'government', lang: 'ja', categories: ['functional-food', 'supplements'] },
  // 학회
  { name: '日本皮膚科学会 (Japan Dermatological Association)', url: 'https://www.dermatol.or.jp', type: 'institution', lang: 'ja', categories: ['skin-care', 'beauty', 'anti-aging', 'medical-procedure'] },
  { name: '日本美容皮膚科学会', url: 'https://www.jscd.org', type: 'institution', lang: 'ja', categories: ['skin-care', 'beauty', 'anti-aging'] },
  { name: '日本医師会 (Japan Medical Association)', url: 'https://www.med.or.jp', type: 'institution', lang: 'ja', categories: ['health', 'medical-procedure', 'cancer-prevention', 'mental-health'] },
  { name: '日本歯科医師会', url: 'https://www.jda.or.jp', type: 'institution', lang: 'ja', categories: ['dental'] },
  { name: '日本栄養士会', url: 'https://www.dietitian.or.jp', type: 'institution', lang: 'ja', categories: ['supplements', 'functional-food', 'diet-clinic'] },
  // 저널
  { name: '日本皮膚科学会雑誌', url: 'https://www.dermatol.or.jp/modules/publication', type: 'journal', lang: 'ja', categories: ['skin-care', 'beauty', 'anti-aging'] },
  { name: '日本老年医学会雑誌', url: 'https://www.jpn-geriat-soc.or.jp', type: 'journal', lang: 'ja', categories: ['anti-aging', 'health', 'supplements'] },
]

// ─── 모든 언어 공통 출처 ────────────────────────────────────────
const ALL_REFERENCES: Reference[] = [
  { name: 'Cochrane Reviews', url: 'https://www.cochranelibrary.com', type: 'database', lang: 'all', categories: ['health', 'medical-procedure', 'supplements'] },
]

/**
 * 언어·카테고리에 맞는 참고문헌을 랜덤하게 1~3개 선택
 */
export function getRandomReferences(
  language: 'ko' | 'en' | 'ja',
  category: string,
  count?: number
): Reference[] {
  // 언어별 풀 선택
  const langPool: Reference[] = language === 'ko'
    ? [...KO_REFERENCES, ...ALL_REFERENCES]
    : language === 'ja'
    ? [...JA_REFERENCES, ...EN_REFERENCES.filter(r => r.categories.length === 0 || r.categories.includes(category)), ...ALL_REFERENCES]
    : [...EN_REFERENCES, ...ALL_REFERENCES]

  // 카테고리 필터 (카테고리가 매칭되거나 모든 카테고리에 해당하는 것)
  const catMatched = langPool.filter(
    r => r.categories.length === 0 || r.categories.includes(category)
  )

  // 매칭 없으면 전체 사용
  const pool = catMatched.length >= 2 ? catMatched : langPool

  // 1~3개 랜덤
  const num = count ?? (1 + Math.floor(Math.random() * 3))  // 1, 2, 3 중 랜덤
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(num, shuffled.length))
}

/**
 * 참고문헌을 HTML 섹션으로 변환 (언어별 제목)
 */
export function buildReferencesHTML(refs: Reference[], language: 'ko' | 'en' | 'ja'): string {
  if (refs.length === 0) return ''

  const titles: Record<string, string> = {
    ko: '📚 참고문헌',
    en: '📚 References',
    ja: '📚 参考文献',
  }
  const title = titles[language] || titles.en

  const items = refs.map((ref, i) =>
    `<li style="margin-bottom:6px">` +
    `<a href="${ref.url}" target="_blank" rel="noopener noreferrer nofollow" ` +
    `style="color:#4a9eff;text-decoration:none">${ref.name}</a>` +
    `</li>`
  ).join('\n')

  return `
<hr style="margin:40px 0 24px;border:none;border-top:1px solid #e0e0e0"/>
<section class="references" aria-label="${title}">
  <h2 style="font-size:1.1em;margin-bottom:12px">${title}</h2>
  <ol style="padding-left:20px;font-size:0.9em;color:#555;line-height:1.8">
${items}
  </ol>
</section>`
}
