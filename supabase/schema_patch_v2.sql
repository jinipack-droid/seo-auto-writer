-- =====================================================
-- SEO Auto Writer - DB 스키마 패치 v2
-- 기존 DB에 적용: Supabase SQL Editor에서 실행
-- =====================================================

-- [1] publish_logs.status에 'scheduled' 추가
ALTER TABLE publish_logs
  DROP CONSTRAINT IF EXISTS publish_logs_status_check;

ALTER TABLE publish_logs
  ADD CONSTRAINT publish_logs_status_check
  CHECK (status IN ('pending', 'published', 'failed', 'scheduled'));

-- [2] Cron/수동 발행용 컬럼 추가
ALTER TABLE publish_logs ADD COLUMN IF NOT EXISTS content          TEXT;
ALTER TABLE publish_logs ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE publish_logs ADD COLUMN IF NOT EXISTS prompt_used      JSONB;

-- 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'publish_logs'
ORDER BY ordinal_position;
