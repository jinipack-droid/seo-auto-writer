-- =====================================================
-- SEO Auto Writer - Supabase 테이블 스키마
-- 기획서 기반 4개 테이블
-- =====================================================
-- Supabase 대시보드 → SQL Editor에서 전체 실행
-- =====================================================

-- 확장 기능 활성화
create extension if not exists "uuid-ossp";

-- -----------------------------------------------
-- [1] sites: 15개 WordPress 사이트 정보
-- -----------------------------------------------
create table if not exists sites (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,                          -- 사이트 이름
  url         text not null unique,                   -- 사이트 URL (예: healthkr1.com)
  language    text not null check (language in ('ko', 'en', 'ja')),  -- 언어
  category    text not null,                          -- 주요 카테고리
  wp_url      text not null,                          -- WordPress REST API 엔드포인트
  wp_username text not null,                          -- WordPress 관리자 계정
  wp_app_password text not null,                      -- WordPress Application Password
  is_active   boolean default true,                   -- 활성 여부
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- -----------------------------------------------
-- [2] personas: 페르소나 8종 (P-01 ~ P-08)
-- -----------------------------------------------
create table if not exists personas (
  id            uuid primary key default uuid_generate_v4(),
  code          text not null unique,                 -- P-01 ~ P-08
  name          text not null,                        -- 작성자 이름 (예: Dr. Sarah Mitchell)
  title         text not null,                        -- 직함 (예: Dermatologist)
  language      text not null check (language in ('ko', 'en', 'ja')),
  categories    text[] not null,                      -- 담당 카테고리 배열
  writing_style text not null,                        -- 문체 설명
  system_prompt text not null,                        -- Claude API system 프롬프트
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- -----------------------------------------------
-- [3] keywords: 카테고리별 타겟 키워드
-- -----------------------------------------------
create table if not exists keywords (
  id           uuid primary key default uuid_generate_v4(),
  keyword      text not null,                         -- 타겟 키워드
  language     text not null check (language in ('ko', 'en', 'ja')),
  category     text not null,                         -- 카테고리 (건강/피부/미용/운동/뷰티/화장/건강식/건강기능식품)
  search_intent text check (search_intent in ('informational', 'commercial', 'transactional', 'navigational')),
  priority     int default 3 check (priority between 1 and 5),  -- 우선순위 (1=낮음, 5=높음)
  used_count   int default 0,                         -- 사용 횟수
  last_used_at timestamptz,                           -- 마지막 사용 시각
  is_active    boolean default true,
  created_at   timestamptz default now()
);

-- -----------------------------------------------
-- [4] publish_logs: 발행 이력 로그
-- -----------------------------------------------
create table if not exists publish_logs (
  id              uuid primary key default uuid_generate_v4(),
  site_id         uuid references sites(id) on delete set null,
  keyword_id      uuid references keywords(id) on delete set null,
  persona_id      uuid references personas(id) on delete set null,
  keyword_text    text not null,                      -- 키워드 스냅샷 (삭제돼도 기록 보존)
  title           text not null,                      -- 발행된 글 제목
  wp_post_id      bigint,                             -- WordPress 글 ID
  wp_post_url     text,                               -- 발행된 글 URL
  language        text not null,
  category        text not null,
  word_count      int,                                -- 글자 수
  image_count     int,                                -- 이미지 수
  prompt_type     text,                               -- 사용된 프롬프트 타입 (A/B/C/D)
  scheduled_at    timestamptz,                        -- 예약 발행 시각
  published_at    timestamptz,                        -- 실제 발행 시각
  status          text default 'pending' check (status in ('pending', 'published', 'failed', 'scheduled')),
  error_message   text,                               -- 실패 시 오류 메시지
  claude_tokens   int,                                -- Claude API 사용 토큰
  content         text,                               -- 생성된 HTML 콘텐츠 (Cron/수동 발행용)
  meta_description text,                              -- 메타 디스크립션
  prompt_used     jsonb,                              -- 사용된 프롬프트 정보
  created_at      timestamptz default now()
);

-- -----------------------------------------------
-- 인덱스 (성능 최적화)
-- -----------------------------------------------
create index if not exists idx_publish_logs_site_id   on publish_logs(site_id);
create index if not exists idx_publish_logs_status     on publish_logs(status);
create index if not exists idx_publish_logs_created_at on publish_logs(created_at desc);
create index if not exists idx_keywords_language_cat   on keywords(language, category);
create index if not exists idx_keywords_active         on keywords(is_active);

-- -----------------------------------------------
-- 페르소나 초기 데이터 삽입 (영어 5종)
-- -----------------------------------------------
insert into personas (code, name, title, language, categories, writing_style, system_prompt) values
  ('P-01', 'Dr. Sarah Mitchell', 'MD, Dermatologist', 'en',
   array['skin-care', 'beauty', 'anti-aging'],
   'Professional, evidence-based, warm',
   'You are Dr. Sarah Mitchell, a board-certified dermatologist with 15 years of experience. Write in a professional yet approachable tone.'),

  ('P-02', 'Jessica Park', 'RN, Health Writer', 'en',
   array['general-health', 'wellness'],
   'Conversational, empathetic, practical',
   'You are Jessica Park, a registered nurse and health writer. Write in a conversational, caring tone that makes complex health topics easy to understand.'),

  ('P-03', 'Dr. Michael Chen', 'PhD, Nutrition Science', 'en',
   array['nutrition', 'supplements', 'health-food'],
   'Scientific but accessible',
   'You are Dr. Michael Chen, a nutrition scientist. Write evidence-based content about nutrition and supplements in an accessible way.'),

  ('P-04', 'Emma Rodriguez', 'Certified Esthetician', 'en',
   array['beauty', 'makeup', 'skin-care'],
   'Enthusiastic, trend-aware, practical',
   'You are Emma Rodriguez, a certified esthetician with expertise in skincare and beauty. Write with enthusiasm and practical tips.'),

  ('P-05', 'Dr. Lisa Thompson', 'PharmD, Pharmacist', 'en',
   array['supplements', 'health-functional-food', 'medical-procedures'],
   'Precise, safety-focused, trustworthy',
   'You are Dr. Lisa Thompson, a licensed pharmacist. Focus on safety, efficacy, and evidence-based information.')
on conflict (code) do nothing;

-- -----------------------------------------------
-- 완료 확인
-- -----------------------------------------------
select 'Schema created successfully!' as status;
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
