---
description: 작업 완료 후 NOTES.md 업데이트 및 Git 커밋
---

# 작업 완료 후 NOTES.md 업데이트 워크플로우

## 목적
매 작업 세션 완료 시 NOTES.md를 업데이트하고 Git 커밋을 수행하여,
다음 대화에서도 이전 작업 내역을 정확히 파악할 수 있도록 합니다.

## 규칙 (항상 준수)
1. **파일 수정 시 반드시 부분 수정** (`replace_file_content` 또는 `multi_replace_file_content`) 사용
2. 파일 전체 재작성(`write_to_file` with Overwrite)은 신규 파일 생성 시에만 허용
3. 기존 파일을 대규모 수정할 때는 **NOTES.md를 먼저 읽어** 보호 항목 확인

## 워크플로우 단계

### 1단계: 새 대화 시작 시 (항상 실행)
NOTES.md를 먼저 읽어 이전 작업 내역과 보호 항목 확인:
```
view_file("seo-auto-writer/NOTES.md")
```

### 2단계: 작업 완료 후 NOTES.md 업데이트
작업이 완료되면 NOTES.md의 해당 섹션을 부분 수정으로 업데이트:
- "절대 건드리면 안 되는 수정 사항" 테이블에 새 항목 추가 (필요 시)
- "완료된 주요 작업 내역" 섹션에 작업 내용 추가
- 마지막 업데이트 날짜 갱신

### 3단계: Git 커밋 (Git 설치 후)
// turbo
```powershell
cd "c:\Users\user\Desktop\AI프로그램_관련\구글,야후제팬,네이버 웹사잍 제작, SEO상위노출 글쓰기 프로그램 제작\seo-auto-writer"
git add -A
git commit -m "작업 완료: [작업 내용 요약]"
```

## Git 설치 방법 (미설치 시)
1. https://git-scm.com/download/win 접속
2. 다운로드 후 설치 (기본 옵션으로 설치)
3. PowerShell 재시작 후 `git --version` 확인
4. 프로젝트 폴더에서 초기화:
```powershell
git init
git add -A
git commit -m "초기 커밋"
```

## 복구 방법 (실수로 파일이 덮어씌워진 경우)
```powershell
git log --oneline          # 커밋 목록 확인
git restore <파일명>        # 마지막 커밋 상태로 복구
git checkout <해시> <파일>  # 특정 커밋 시점으로 복구
```
