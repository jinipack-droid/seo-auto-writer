import { NextRequest, NextResponse } from 'next/server'
import { generateCardImage } from '@/lib/image/satori-generator'

/**
 * POST /api/generate-image
 * 설정 페이지 미리보기, 외부 호출 등에서 카드 이미지 직접 생성 (Satori)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.title || !body.category || !body.language) {
      return NextResponse.json({ error: 'title, category, language 필수' }, { status: 400 })
    }

    const png = await generateCardImage(body)

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
 * 테스트용 샘플 이미지 생성 (Satori)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lang = searchParams.get('lang') || 'ko'
  const cat  = searchParams.get('cat') || 'skin-care'
  const layoutStr = searchParams.get('layout')
  const layout = layoutStr ? parseInt(layoutStr) % 20 : Math.floor(Math.random() * 20)

  const samples: Record<string, Record<string, unknown>> = {
    ko: {
      title: '비타민C 효능 완전 가이드',
      captions: ['미백 효과', '항산화 작용', '콜라겐 생성', '면역력 강화'],
      category: cat, language: 'ko', layout, variant: Math.floor(Math.random() * 5),
    },
    en: {
      title: 'Vitamin C Complete Guide',
      captions: ['Brightening', 'Antioxidant', 'Collagen Boost', 'Immunity'],
      category: cat, language: 'en', layout, variant: Math.floor(Math.random() * 5),
    },
    ja: {
      title: 'ビタミンC完全ガイド',
      captions: ['美白効果', '抗酸化作用', 'コラーゲン生成', '免疫力UP'],
      category: cat, language: 'ja', layout, variant: Math.floor(Math.random() * 5),
    },
  }

  try {
    const data = samples[lang] || samples.ko
    const png = await generateCardImage(data as unknown as Parameters<typeof generateCardImage>[0])

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Layout': String(layout) },
    })
  } catch (e) {
    console.error('[generate-image GET]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
