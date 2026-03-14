import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lang   = searchParams.get('lang')   || 'all'
    const status = searchParams.get('status') || 'all'
    const limit  = parseInt(searchParams.get('limit') || '100')
    const page   = parseInt(searchParams.get('page')  || '1')
    const offset = (page - 1) * limit

    const supabase = createServiceClient()

    let query = supabase
      .from('publish_logs')
      .select('*, sites!site_id(name, url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (lang   !== 'all') query = query.eq('language', lang)
    if (status !== 'all') query = query.eq('status', status)

    const { data, error, count } = await query

    if (error) {
      console.error('Supabase 로그 조회 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 통계 집계
    const { data: stats } = await supabase
      .from('publish_logs')
      .select('status, language, claude_tokens')

    const summary = {
      total:     stats?.length || 0,
      published: stats?.filter(s => s.status === 'published').length || 0,
      pending:   stats?.filter(s => s.status === 'pending').length || 0,
      scheduled: stats?.filter(s => s.status === 'scheduled').length || 0,
      failed:    stats?.filter(s => s.status === 'failed').length || 0,
      tokens:    stats?.reduce((sum, s) => sum + (s.claude_tokens || 0), 0) || 0,
    }

    return NextResponse.json({ logs: data, total: count, summary })

  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// 로그 상태 업데이트 (pending → published / failed)
export async function PATCH(request: Request) {
  try {
    const { id, status, wp_post_url, error_message } = await request.json()
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('publish_logs')
      .update({
        status,
        wp_post_url:   wp_post_url   || null,
        error_message: error_message || null,
        published_at:  status === 'published' ? new Date().toISOString() : null,
      })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// 로그 삭제
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    const supabase = createServiceClient()

    const { error } = await supabase.from('publish_logs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
