import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lang   = searchParams.get('lang')   || 'all'
    const active = searchParams.get('active') || 'all'

    const supabase = createServiceClient()
    let query = supabase
      .from('sites')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (lang   !== 'all') query = query.eq('language', lang)
    if (active === 'true')  query = query.eq('is_active', true)
    if (active === 'false') query = query.eq('is_active', false)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 통계
    const { data: all } = await supabase.from('sites').select('language, is_active')
    const summary = {
      total:   all?.length || 0,
      active:  all?.filter(s => s.is_active).length || 0,
      en:      all?.filter(s => s.language === 'en').length || 0,
      ko:      all?.filter(s => s.language === 'ko').length || 0,
      ja:      all?.filter(s => s.language === 'ja').length || 0,
    }

    return NextResponse.json({ sites: data, total: count, summary })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()

    const insert = {
      name:            body.name,
      url:             body.url,
      language:        body.language,
      category:        body.category,
      wp_url:          body.wp_url || '',
      wp_username:     body.wp_username || '',
      wp_app_password: body.wp_app_password || '',
      is_active:       body.is_active ?? true,
    }

    const { data, error } = await supabase.from('sites').insert(insert).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ site: data?.[0] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('sites')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
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
    const { error } = await supabase.from('sites').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
