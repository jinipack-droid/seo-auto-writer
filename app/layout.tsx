import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { LanguageProvider } from '@/lib/language-context'

export const metadata: Metadata = {
  title: 'SEO Auto Writer',
  description: 'AI 기반 SEO 콘텐츠 자동 생성 프로그램',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <LanguageProvider>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ marginLeft: '190px', flex: 1, background: '#0d0d0d', minHeight: '100vh' }}>
              <div style={{ padding: '20px' }}>{children}</div>
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  )
}
