import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lang     = searchParams.get('lang')     || 'all'
    const category = searchParams.get('category') || 'all'
    const limit    = parseInt(searchParams.get('limit') || '200')

    const supabase = createServiceClient()
    let query = supabase
      .from('keywords')
      .select('*', { count: 'exact' })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (lang     !== 'all') query = query.eq('language', lang)
    if (category !== 'all') query = query.eq('category', category)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 통계 (언어별 정확한 count)
    const [allRes, enRes, koRes, jaRes, activeRes] = await Promise.all([
      supabase.from('keywords').select('*', { count: 'exact', head: true }),
      supabase.from('keywords').select('*', { count: 'exact', head: true }).eq('language', 'en'),
      supabase.from('keywords').select('*', { count: 'exact', head: true }).eq('language', 'ko'),
      supabase.from('keywords').select('*', { count: 'exact', head: true }).eq('language', 'ja'),
      supabase.from('keywords').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ])
    const summary = {
      total:     allRes.count    || 0,
      active:    activeRes.count || 0,
      en:        enRes.count     || 0,
      ko:        koRes.count     || 0,
      ja:        jaRes.count     || 0,
      totalUses: 0,
    }

    return NextResponse.json({ keywords: data, total: count, summary })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    // 다수 키워드 일괄 등록 지원
    const rows = Array.isArray(body) ? body : [body]
    const inserts = rows.map(r => ({
      keyword:        r.keyword,
      language:       r.language,
      category:       r.category,
      search_intent:  r.search_intent || 'informational',
      priority:       r.priority ?? 3,
      is_active:      r.is_active ?? true,
    }))

    const { data, error } = await supabase.from('keywords').insert(inserts).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ keywords: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    // 카테고리 일괄 비활성화: { category: 'finance', is_active: false }
    if (body.category && body.is_active !== undefined && !body.id) {
      const { error } = await supabase
        .from('keywords')
        .update({ is_active: body.is_active })
        .eq('category', body.category)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // 단건 업데이트: { id, ...updates }
    const { id, ...updates } = body
    const { error } = await supabase.from('keywords').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    const supabase = createServiceClient()
    const { error } = await supabase.from('keywords').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
