-- Free 체험 기간 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_trial_expires_at TIMESTAMPTZ;

-- 기존 가입자: NULL (무제한)
-- 신규 가입자: 트리거에서 now() + 7일 자동 설정

-- handle_new_user 트리거 함수 수정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, free_trial_expires_at)
  VALUES (NEW.id, now() + interval '7 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
