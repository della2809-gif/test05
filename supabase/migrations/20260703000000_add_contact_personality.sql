-- 고객 성향(논리적/감성적/실용적) — 회원(contacts) 단위 저장.
-- 성향의 주체는 직원이 아니라 고객이며, 고객 발송 문구의 톤에만 반영된다. NULL = 미파악.
-- (2026-07-03 고객성향 반영 아키텍처 P2)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS personality TEXT
  CHECK (personality IN ('logical', 'emotional', 'practical'));
