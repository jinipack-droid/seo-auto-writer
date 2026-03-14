# SEO Auto Writer - 작업 내역 (NOTES.md)

> 🙋 **호칭**: 이 프로젝트의 오너는 **대표님**입니다. 항상 "대표님"으로 호칭할 것.

> ⚠️ 이 파일은 AI 작업 시 **가장 먼저 읽어야** 할 파일입니다.
> 새 대화 시작 시 반드시 이 파일을 확인하고 작업하세요.
> 파일 전체 재작성(Overwrite) 금지 — 반드시 **부분 수정(multi_replace / replace_file_content)** 사용!

---

## 📌 절대 건드리면 안 되는 수정 사항 (덮어쓰기 금지)

| 파일 | 위치 | 내용 |
|------|------|------|
| `app/personas/page.tsx` | 333번째 줄 | `'⏳ 글과 이미지 생성 중... (약 5분)'` — 30초 → 5분으로 변경된 것 유지 |

---

## 🏗️ 프로젝트 구조 개요

- **Next.js 앱** (포트 3000): `npm run dev`
- **이미지 서버** (포트 3001): `node image-server.mjs`
- **DB**: Supabase
- **배포**: Vercel

### 주요 디렉토리
```
app/
  personas/     - 아이디&페르소나 관리
  keywords/     - 키워드 관리
  sites/        - 사이트 관리
  settings/     - 설정
  api/
    generate/   - 글 생성 API
    preview/    - 미리보기 API (글+이미지 생성, base64)
    publish/    - 발행 API (WordPress 업로드)
    translate/  - 번역 API
    sites/      - 사이트 CRUD API
    personas/   - 페르소나 CRUD API
    keywords/   - 키워드 CRUD API
    logs/       - 발행 로그 API
    cron/       - 자동 스케줄 발행
lib/
  wordpress/client.ts   - WordPress REST API 클라이언트
  image/card-generator.ts - 이미지 카드 생성
  prompts/seo-prompts.ts  - SEO 프롬프트 템플릿
  language-context.tsx    - 다국어(KO/EN/JA) 컨텍스트
image-server.mjs          - Canvas 기반 이미지 생성 서버 (70+ 템플릿)
```

---

## 📋 완료된 주요 작업 내역

### 2026-03 ~ 현재

#### 🖼️ 이미지 시스템
- `image-server.mjs`: Canvas 기반 이미지 생성 서버 구현 (템플릿 36개 이상)
- 이미지 템플릿 샘플 분석 후 레이아웃 추가 (템플릿 37~66번 등)
- 이미지 업로드 디버깅: WordPress 포스트에 이미지 올바르게 삽입되도록 수정
- 이미지 URL을 attachment ID 대신 실제 URL로 임베드하도록 수정
- 이미지 테마/컬러 다양성 보장 로직 개선

#### 🌐 WordPress 연동
- WordPress 사이트 연결 실패 문제 해결 (CORS 오류)
- 서버사이드 API 프록시 구현으로 연결 테스트 정상화
- 연결 테스트 오류 메시지 개선

#### 📝 글 생성/발행 플로우
- 2단계 발행 플로우 구현:
  1. `/api/preview` → 글+이미지 생성 (base64), 미리보기 표시
  2. `/api/publish/[id]` → 실제 WordPress 발행
- 페르소나별 테스트 발행 팝업 구현
- 글 생성 중 로딩 문구: "약 5분" (30초에서 변경 — **절대 되돌리지 말 것**)

#### 🎨 UI/디자인
- 히어로 섹션 슬라이더 형태로 개편
- 사이드바(Sidebar.tsx) UI 개선
- 다국어 지원 (KO/EN/JA) 언어 컨텍스트 적용

#### 🗄️ DB / Supabase
- schema.sql, schema_patch_v2.sql 작업
- 페르소나, 키워드, 사이트, 발행 로그 테이블 구조

---

## 🔧 Git 설정 정보
- `git config --global user.name "대표님"`
- `git config --global user.email "admin@seoautowriter.com"`
- 초기 커밋 완료: 2026-03-14

## 🔧 서버 실행 방법

```powershell
# 이미지 서버 (포트 3001)
node image-server.mjs

# Next.js 앱 (포트 3000)
npm run dev
```

포트 충돌 시:
```powershell
Get-Process -Id (netstat -ano | findstr ":3000" | Where-Object { $_ -match "LISTENING" } | ForEach-Object { ($_ -split "\s+")[-1] } | Select-Object -First 1) | Stop-Process -Force
```

---

## ⚙️ 환경 변수 (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (이미지 생성용)
- WordPress 사이트별 인증 정보

---

*마지막 업데이트: 2026-03-14 (Git 초기화 완료, 대표님 호칭 등록)*
