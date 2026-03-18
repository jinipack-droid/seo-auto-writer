import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
  const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY         || ''

  return NextResponse.json({
    supabase:  !!(supabaseUrl && supabaseKey),
    anthropic: !!(anthropicKey.startsWith('sk-')),
  })
}
