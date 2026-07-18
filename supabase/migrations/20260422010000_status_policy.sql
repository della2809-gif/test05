-- 상태 전환 정책 재정비
-- 1. 신규 가입: now() + 7일 (handle_new_user 에서 처리)
-- 2. Free → Paid: payment_date = now(), free_trial_expires_at = NULL (무제한)
-- 3. Paid → Free: payment_date = NULL, free_trial_expires_at = 오늘 밤 KST 자정

CREATE OR REPLACE FUNCTION public.handle_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status = 'free' THEN
    NEW.payment_date = now();
    NEW.free_trial_expires_at = NULL;
  END IF;

  IF NEW.status = 'free' AND OLD.status = 'paid' THEN
    NEW.payment_date = NULL;
    -- 오늘 밤 KST 자정 (내일 00:00 KST)
    NEW.free_trial_expires_at = (
      date_trunc('day', (now() AT TIME ZONE 'Asia/Seoul')) + interval '1 day'
    ) AT TIME ZONE 'Asia/Seoul';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
