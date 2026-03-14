import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { texts } = await req.json()
    // texts = { name, title, writing_style, system_prompt }
    const prompt = `다음 텍스트를 자연스러운 한국어로 번역해주세요. JSON 형식으로만 응답하세요.

번역할 내용:
- name: ${texts.name}
- title: ${texts.title}
- writing_style: ${texts.writing_style || ''}
- system_prompt: ${texts.system_prompt || ''}

다음 JSON 형식으로만 응답 (다른 설명 없이):
{"name":"...","title":"...","writing_style":"...","system_prompt":"..."}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = raw.replace(/^```json\s*/,'').replace(/\s*```$/,'')
    const translated = JSON.parse(jsonStr)
    return NextResponse.json({ translated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
