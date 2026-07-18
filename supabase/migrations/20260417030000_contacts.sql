-- contacts: 고객 명단 테이블
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  member_id TEXT,
  join_date DATE,
  first_order_date DATE,
  member_status TEXT CHECK (member_status IN (
    '신규등록','주문대기','섭취중','사업관심','관망','관리필요','중단'
  )),
  care_mode TEXT CHECK (care_mode IN (
    '집중','정기','누적','자율','임시중단'
  )),
  contact_frequency TEXT CHECK (contact_frequency IN (
    '매일','주2회','주1회','2주1회','월1회','필요시'
  )),
  last_contact_date DATE,
  ao_cycle_date DATE,
  coupon_remaining INTEGER DEFAULT 2,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_member_status ON public.contacts(user_id, member_status);

-- RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_owner" ON public.contacts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "contacts_admin" ON public.contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_contacts_updated_at();
