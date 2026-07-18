-- schedules: 일정 관리
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID,          -- contacts FK (선택적)
  title TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN (
    'ao_check',    -- AO 확인 (contacts에서 자동 생성)
    'milestone',   -- 마일스톤 (13주/17주/쿠폰)
    'meeting',     -- 미팅/상담
    'followup',    -- 팔로업
    'personal'     -- 개인 일정
  )),
  life_layer TEXT CHECK (life_layer IN (
    '개인','가족','본업','유산화','투잡'
  )),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  is_done BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON public.schedules(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON public.schedules(user_id, schedule_type);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_owner" ON public.schedules
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "schedules_admin" ON public.schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
