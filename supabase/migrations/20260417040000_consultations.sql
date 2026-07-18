-- consultations: 건강상담 기록
CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_id UUID,  -- contacts 테이블 FK (선택적, 나중에 연결)
  health_scores JSONB,        -- {A:3, B:5, ...}
  lifestyle_slots JSONB,      -- {goal, diet, sleep, exercise, notes}
  inbody_data JSONB,          -- {weight, bodyFatPercent, ...}
  recommended_products JSONB, -- [{name, quantity, unitPrice}]
  quotation JSONB,            -- {premium:{...}, standard:{...}, basic:{...}}
  judgment JSONB,             -- {needsReset, needsChallenge, focusAreas, ...}
  order_status TEXT NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending','ordered','skipped')),
  next_memo TEXT,
  attachments TEXT[],
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON public.consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_contact_id ON public.consultations(contact_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON public.consultations(created_at DESC);

-- RLS
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultations_owner" ON public.consultations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "consultations_admin" ON public.consultations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
