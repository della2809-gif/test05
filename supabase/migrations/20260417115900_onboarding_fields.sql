-- 온보딩 필드 확장: 유사나/일반 구분, 멘토 2단계
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS member_type TEXT CHECK (member_type IN ('usana', 'general')),
  ADD COLUMN IF NOT EXISTS direct_mentor_name TEXT,
  ADD COLUMN IF NOT EXISTS direct_mentor_phone TEXT,
  ADD COLUMN IF NOT EXISTS leaders_mentor_name TEXT,
  ADD COLUMN IF NOT EXISTS leaders_mentor_phone TEXT;
