import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const status = {
    supabase: false,
    anthropic: false,
    gemini: false,
  }

  // Supabase 연결 확인
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      const supabase = createServiceClient()
      const { error } = await supabase.from('sites').select('id').limit(1)
      status.supabase = !error
    }
  } catch { /* ignore */ }

  // Anthropic API 키 존재 여부
  status.anthropic = !!(process.env.ANTHROPIC_API_KEY?.startsWith('sk-'))

  // Gemini API 키 존재 여부
  status.gemini = !!(process.env.GEMINI_API_KEY?.startsWith('AIza'))

  return NextResponse.json(status)
}
