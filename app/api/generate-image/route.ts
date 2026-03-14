import { NextRequest, NextResponse } from 'next/server'

/**
 * 이미지 서버 HTTP 호출 (localhost:3001)
 * @napi-rs/canvas native 모듈을 Next.js에서 직접 실행 불가 → 별도 image-server.mjs로 분리
 */
async function generateCardImageViaServer(data: Record<string, unknown>): Promise<Buffer> {
  const res = await fetch('http://localhost:3001/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`image-server 응답 오류: ${res.status} ${await res.text()}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * POST /api/generate-image
 * 설정 페이지 미리보기, 외부 호출 등에서 카드 이미지 직접 생성
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.title || !body.category || !body.language) {
      return NextResponse.json({ error: 'title, category, language 필수' }, { status: 400 })
    }

    const png = await generateCardImageViaServer(body)

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="card-${body.category}-${body.language}.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[generate-image]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

/**
 * GET /api/generate-image?lang=ko&cat=skin-care
 * 테스트용 샘플 이미지 생성
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lang = searchParams.get('lang') || 'ko'
  const cat  = searchParams.get('cat') || 'skin-care'

  const samples: Record<string, Record<string, unknown>> = {
    ko: {
      title: '보톡스 시술 완벽 가이드',
      subtitle: '효과·지속기간·비용 총정리 2025',
      category: cat,
      language: 'ko',
      points: [
        { label: '⏱ 지속기간', value: '4~6개월 평균' },
        { label: '⏰ 시술시간', value: '15~30분 이내' },
        { label: '💰 평균비용', value: '10~30만원대' },
      ],
    },
    en: {
      title: 'NAD+ Therapy Complete Guide',
      subtitle: 'Cellular Rejuvenation & Longevity Science 2025',
      category: cat,
      language: 'en',
      points: [
        { label: '⚡ Energy Boost', value: 'Up to 60% increase' },
        { label: '💉 Delivery Method', value: 'IV drip or oral supplement' },
        { label: '🧬 Target', value: 'Mitochondrial health' },
      ],
    },
    ja: {
      title: 'インプラント治療 完全ガイド',
      subtitle: '費用・期間・注意点を徹底解説 2025',
      category: cat,
      language: 'ja',
      points: [
        { label: '🦷 治療期間', value: '3〜6ヶ月' },
        { label: '💴 費用相場', value: '30〜50万円' },
        { label: '✅ 成功率', value: '約95%以上' },
      ],
    },
  }

  try {
    const data = samples[lang] || samples.ko
    const png = await generateCardImageViaServer(data)

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('[generate-image GET]', e)
    return NextResponse.json({ error: 'image-server.mjs가 실행 중인지 확인하세요 (port 3001)' }, { status: 500 })
  }
}
