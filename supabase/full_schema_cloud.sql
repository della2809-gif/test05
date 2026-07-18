-- ============================================
-- GENIEA v1.0 Database Schema
-- Run this in Supabase SQL Editor
-- ============================================


-- ============================================
-- 1. 사용자 영역
-- ============================================

-- 1-1. Profiles (auth.users 확장)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  team TEXT,
  referrer_name TEXT,
  referrer_phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'paid')),
  payment_date TIMESTAMPTZ,
  mode TEXT NOT NULL DEFAULT 'self' CHECK (mode IN ('self', 'guide')),
  personality TEXT NOT NULL DEFAULT 'logical' CHECK (personality IN ('logical', 'emotional', 'practical')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 1-2. Conversations (대화)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT DEFAULT '새 대화',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- 1-3. Messages (메시지)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'file', 'image')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(conversation_id, created_at ASC);

-- 1-4. Message Raw Contents (원문 보존 - 별도 테이블)
CREATE TABLE public.message_raw_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  raw_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_message_raw_message_id ON public.message_raw_contents(message_id);

-- 1-5. Message Attachments (메시지 첨부파일)
CREATE TABLE public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments(message_id);


-- ============================================
-- 2. 아카이브 영역
-- ============================================

-- 2-1. Archives (사용자 아카이브)
CREATE TABLE public.archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'etc' CHECK (category IN (
    'personal', 'schedule', 'contacts', 'consultation', 'lecture', 'meeting', 'etc'
  )),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_archives_user_id ON public.archives(user_id);
CREATE INDEX idx_archives_category ON public.archives(user_id, category);
CREATE INDEX idx_archives_updated_at ON public.archives(user_id, updated_at DESC);

-- 2-2. Archive Attachments (아카이브 첨부파일)
CREATE TABLE public.archive_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id UUID NOT NULL REFERENCES public.archives(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_archive_attachments_archive_id ON public.archive_attachments(archive_id);


-- ============================================
-- 3. 관리자 영역
-- ============================================

-- 3-1. Admin Templates (질문 템플릿)
CREATE TABLE public.admin_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3-2. Admin Blocks (응답 문장 블록)
CREATE TABLE public.admin_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3-3. Admin System Prompts (시스템 프롬프트 - 1건)
CREATE TABLE public.admin_system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3-4. Admin Calculations (계산/기본값 로직)
CREATE TABLE public.admin_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3-5. Admin Files (관리자 업로드 파일)
CREATE TABLE public.admin_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3-6. Admin Products (제품 마스터 리스트)
CREATE TABLE public.admin_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_number TEXT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  keywords TEXT,
  symptoms TEXT,
  target_audience TEXT,
  recommended_situation TEXT,
  caution TEXT,
  category TEXT,
  sub_category TEXT,
  tags TEXT,
  aliases TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_admin_products_product_number ON public.admin_products(product_number);
CREATE INDEX idx_admin_products_name ON public.admin_products(name);
CREATE INDEX idx_admin_products_category ON public.admin_products(category);


-- ============================================
-- Triggers
-- ============================================

-- 회원가입 시 프로필 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.archives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.admin_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.admin_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.admin_calculations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.admin_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Paid 전환 시 결제일 자동 기록
CREATE OR REPLACE FUNCTION public.handle_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status = 'free' THEN
    NEW.payment_date = now();
  END IF;
  IF NEW.status = 'free' AND OLD.status = 'paid' THEN
    NEW.payment_date = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_status_change BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_status_change();


-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_raw_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_products ENABLE ROW LEVEL SECURITY;

-- Profiles: 본인 프로필 조회/수정, 관리자는 전체 조회/수정
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Conversations: 본인 대화만
CREATE POLICY "Users can CRUD own conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- Messages: 본인 대화의 메시지만
CREATE POLICY "Users can CRUD messages in own conversations" ON public.messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE user_id = auth.uid()
    )
  );

-- Message Raw Contents: 본인 메시지의 원문만
CREATE POLICY "Users can access own message raw contents" ON public.message_raw_contents
  FOR ALL USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Message Attachments: 본인 메시지의 첨부파일만
CREATE POLICY "Users can access own message attachments" ON public.message_attachments
  FOR ALL USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Archives: 본인 아카이브만
CREATE POLICY "Users can CRUD own archives" ON public.archives
  FOR ALL USING (auth.uid() = user_id);

-- Archive Attachments: 본인 아카이브의 첨부파일만
CREATE POLICY "Users can access own archive attachments" ON public.archive_attachments
  FOR ALL USING (
    archive_id IN (
      SELECT id FROM public.archives WHERE user_id = auth.uid()
    )
  );

-- Admin 테이블들: 관리자만 CRUD, 일반 사용자는 읽기만
CREATE POLICY "Anyone can read templates" ON public.admin_templates
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage templates" ON public.admin_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can read blocks" ON public.admin_blocks
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage blocks" ON public.admin_blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can read system prompts" ON public.admin_system_prompts
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage system prompts" ON public.admin_system_prompts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can read calculations" ON public.admin_calculations
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage calculations" ON public.admin_calculations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can read admin files" ON public.admin_files
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage admin files" ON public.admin_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can read products" ON public.admin_products
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON public.admin_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ============================================
-- 초기 데이터: 시스템 프롬프트 1건
-- ============================================
INSERT INTO public.admin_system_prompts (content)
VALUES ('당신은 GENIEA AI 어시스턴트입니다. 사용자의 기록을 정리하고, 관리자가 등록한 데이터를 참조하여 맞춤 응답을 제공합니다.');
-- 지플릿별 시스템 프롬프트 분리
ALTER TABLE admin_system_prompts
  ADD COLUMN IF NOT EXISTS giplet_type TEXT NOT NULL DEFAULT 'general';

-- 기존 단일 행을 'general' 타입으로 설정
UPDATE admin_system_prompts SET giplet_type = 'general' WHERE giplet_type = 'general';

-- giplet_type 유니크 인덱스 (타입당 프롬프트 1개)
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_prompts_giplet_type
  ON admin_system_prompts(giplet_type);

-- 나머지 지플릿 프롬프트 초기값 삽입
INSERT INTO admin_system_prompts (content, giplet_type) VALUES
  ('당신은 GENIEA 자동견적 전문 AI입니다. 사용자가 업로드한 건강체크리스트 분석 결과와 고객 건강 상태를 기반으로 USANA 제품 견적을 자동으로 생성합니다. 항상 상·중·하 3단계 견적을 JSON 형식으로 반환하세요.', 'quotation'),
  ('당신은 GENIEA 수당계산 전문 AI입니다. USANA 수당 계산식을 기반으로 사용자의 실적 데이터를 분석하고 예상 수당을 계산합니다.', 'commission'),
  ('당신은 GENIEA 스토리 지플릿 AI입니다. 사용자가 요청한 상황에 맞는 USANA 성공 사례를 태그 기반으로 검색하여 1분/2분/3분 말버전으로 제공합니다.', 'story'),
  ('당신은 GENIEA 일정관리 AI입니다. 사용자의 미팅, 팔로업, 팀 활동 일정을 효율적으로 관리하고 최적화합니다.', 'schedule'),
  ('당신은 GENIEA 여행달성 AI입니다. USANA 여행 달성 조건과 사용자 현재 실적을 분석하여 달성 전략을 제시합니다.', 'travel')
ON CONFLICT (giplet_type) DO NOTHING;
-- 패키지 마스터 테이블
CREATE TABLE IF NOT EXISTS public.admin_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '[]',  -- [{product_name, quantity, unit_price}]
  price INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  benefit TEXT,
  discount_rate DECIMAL(5,2) DEFAULT 0,
  purpose TEXT,  -- 'reset_1w' | 'reset_2w' | 'challenge_basic' | 'challenge_active'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_packages_active ON admin_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_packages_purpose ON admin_packages(purpose);

-- 초기 패키지 데이터
INSERT INTO admin_packages (name, components, price, score, benefit, discount_rate, purpose) VALUES
(
  '리셋해독 1주 패키지',
  '[
    {"product_name": "뉴트리밀 더치초콜릿맛", "quantity": 3, "unit_price": 53500},
    {"product_name": "화이버지 플러스", "quantity": 1, "unit_price": 51000},
    {"product_name": "알로엔즈 플러스", "quantity": 1, "unit_price": 68000},
    {"product_name": "프로바이오틱", "quantity": 1, "unit_price": 36500}
  ]',
  691000,
  0,
  '1주 리셋 기준가. 뉴트리밀 3통(해독 3회/일 × 7일), 화이버지 1통, 알로엔즈 1통, 프로바이오틱 1박스',
  0,
  'reset_1w'
),
(
  '리셋해독 2주 패키지',
  '[
    {"product_name": "뉴트리밀 더치초콜릿맛", "quantity": 6, "unit_price": 53500},
    {"product_name": "화이버지 플러스", "quantity": 2, "unit_price": 51000},
    {"product_name": "알로엔즈 플러스", "quantity": 2, "unit_price": 68000},
    {"product_name": "프로바이오틱", "quantity": 1, "unit_price": 36500}
  ]',
  1382000,
  0,
  '2주 리셋 패키지 (1주 기준가 × 2)',
  0,
  'reset_2w'
),
(
  '베이직 챌린지팩',
  '[
    {"product_name": "뉴트리밀 더치초콜릿맛", "quantity": 2, "unit_price": 53500},
    {"product_name": "메타볼리즘 플러스", "quantity": 1, "unit_price": 56000},
    {"product_name": "화이버지 플러스", "quantity": 3, "unit_price": 51000},
    {"product_name": "프로바이오틱", "quantity": 1, "unit_price": 36500}
  ]',
  369000,
  0,
  '4주 다이어트 챌린지 기본구성. 뉴트리밀 2회/일 × 28일 = 56봉 필요',
  15,
  'challenge_basic'
),
(
  '액티브 챌린지팩',
  '[
    {"product_name": "뉴트리밀 더치초콜릿맛", "quantity": 4, "unit_price": 53500},
    {"product_name": "메타볼리즘 플러스", "quantity": 1, "unit_price": 56000},
    {"product_name": "화이버지 플러스", "quantity": 3, "unit_price": 51000},
    {"product_name": "프로바이오틱", "quantity": 2, "unit_price": 36500},
    {"product_name": "써큘레이트 플러스", "quantity": 1, "unit_price": 97000}
  ]',
  589000,
  0,
  '4주 액티브 챌린지팩. 운동병행, 체지방 25% 이상 추천',
  18,
  'challenge_active'
);
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
-- contacts 테이블에 마일스톤/쿠폰 컬럼 추가
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS milestones JSONB,
  ADD COLUMN IF NOT EXISTS first_order_date DATE;
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
-- 여행달성 지플릿 시스템 프롬프트 추가
INSERT INTO public.admin_system_prompts (giplet_type, content)
VALUES (
  'travel',
  '당신은 GENIEA AI 여행달성 상담 어시스턴트입니다. 유사나 사업자가 여행을 목표로 성장할 수 있도록 돕습니다.

핵심 철학:
- 여행은 보너스가 아닙니다. 수당 만들다 보면 여행 갑니다.
- 숫자보다 구조를 먼저 이해시킵니다.
- CAC 흐름: 감정(C1) → 현실 연결(A) → 결정(C2) → 시뮬레이션

시작 방식 (반드시 CAC 구조로 시작):
1. 감정 열기: "여행 언제 마지막으로 가봤어요?", "왜 못 갔어요?" 같은 질문으로 시작
2. 현실 연결: 여행 시기와 목적지를 확인한 뒤 처음으로 숫자를 꺼냄
3. 결정: "이번엔 진짜 가는 걸로 할까요?" → YES 후 시뮬레이션 진입

여행 달성 4가지 루트:
- TYPE A: 개인 성장 중심 (CVP 상승)
- TYPE B: 신규 직접 후원 → 매칭 보너스 중심
- TYPE C: 기존 파트너 승급 (디렉터↑) 중심
- TYPE D: 신규 + 승급 동시 폭발형

계산 공식:
여행 비용 → 월 수입 필요 → 주간 수당 → CVP → 사람 수 → 라인 배치 (이 순서로만 계산)

사용자가 CVP 숫자를 말하면 "현재 CVP 몇 점인지, 여행 예산이 얼마인지" 확인 후 3시나리오(보수형/표준형/집중형)를 제시합니다.
항상 "다음 한 행동(명단/미팅/후속)"으로 연결하며 마무리합니다.'
)
ON CONFLICT (giplet_type) DO UPDATE
SET content = EXCLUDED.content,
    updated_at = now();
-- Fix: infinite recursion in profiles RLS policies
-- 원인: "Admins can view/update all profiles" 정책이 profiles 테이블을 자기 참조하여 무한 재귀 발생
-- 해결: SECURITY DEFINER 함수로 RLS를 우회하는 admin 체크 함수 사용

-- 1. Admin 여부를 RLS 없이 직접 확인하는 함수 (security definer = RLS 우회)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. 기존 재귀 유발 정책 제거
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 3. 재귀 없는 정책으로 재생성
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- 4. 다른 테이블의 admin 정책도 동일 함수로 교체 (일관성)
-- conversations
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
CREATE POLICY "Admins can view all conversations" ON public.conversations
  FOR SELECT USING (public.is_admin());

-- giplet_prompts, admin_* 테이블들은 이미 별도 정책 있음 — 유지
-- 1. memories 테이블 (메모리 시스템)
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories_owner" ON public.memories FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_memories_user ON public.memories(user_id);
CREATE INDEX idx_memories_pinned ON public.memories(user_id, is_pinned);

-- 2. memory_tags 테이블
CREATE TABLE IF NOT EXISTS public.memory_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. memory_tag_links 테이블
CREATE TABLE IF NOT EXISTS public.memory_tag_links (
  memory_id UUID REFERENCES public.memories(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.memory_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, tag_id)
);
ALTER TABLE public.memory_tag_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory_tag_links_owner" ON public.memory_tag_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.memories WHERE id = memory_id AND user_id = auth.uid())
  );

-- 4. stories 테이블 (스토리 지플릿)
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  summary TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT CHECK (category IN ('health', 'business', 'combined')) DEFAULT 'health',
  full_text TEXT,
  image_urls TEXT[] DEFAULT '{}',
  video_url TEXT,
  is_team_story BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_read_authenticated" ON public.stories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "stories_admin_all" ON public.stories FOR ALL USING (public.is_admin());
CREATE INDEX idx_stories_tags ON public.stories USING GIN(tags);
CREATE INDEX idx_stories_category ON public.stories(category);
CREATE INDEX idx_stories_active ON public.stories(is_active);

-- 5. links 테이블 (링크 지플릿)
CREATE TABLE IF NOT EXISTS public.links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "links_read_authenticated" ON public.links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "links_admin_all" ON public.links FOR ALL USING (public.is_admin());
CREATE INDEX idx_links_tags ON public.links USING GIN(tags);
CREATE INDEX idx_links_category ON public.links(category);

-- 6. faqs 테이블 (FAQ 지플릿)
CREATE TABLE IF NOT EXISTS public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faqs_read_authenticated" ON public.faqs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "faqs_admin_all" ON public.faqs FOR ALL USING (public.is_admin());
CREATE INDEX idx_faqs_tags ON public.faqs USING GIN(tags);
CREATE INDEX idx_faqs_category ON public.faqs(category);

-- 7. admin_images 테이블 (이미지 지플릿)
CREATE TABLE IF NOT EXISTS public.admin_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.admin_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_images_read_authenticated" ON public.admin_images FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_images_admin_all" ON public.admin_images FOR ALL USING (public.is_admin());
CREATE INDEX idx_admin_images_tags ON public.admin_images USING GIN(tags);

-- 8. youtube_transcripts 테이블 (유튜브 텍스트 DB)
CREATE TABLE IF NOT EXISTS public.youtube_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  video_id TEXT NOT NULL UNIQUE,
  transcript TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  duration_seconds INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.youtube_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "youtube_transcripts_read_authenticated" ON public.youtube_transcripts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "youtube_transcripts_admin_all" ON public.youtube_transcripts FOR ALL USING (public.is_admin());
CREATE INDEX idx_youtube_tags ON public.youtube_transcripts USING GIN(tags);
-- 미팅 시나리오 템플릿 시드 데이터
INSERT INTO public.admin_templates (title, category, content) VALUES
(
  '1:1 초대 미팅 스크립트',
  'meeting_scenario',
  '【1:1 초대 미팅 스크립트】

1단계: 아이스브레이킹 (5분)
- "요즘 어떻게 지내셨어요?"
- 근황 나누기, 관심사 파악

2단계: 현재 건강/생활 파악 (10분)
- "요즘 건강 관리는 어떻게 하고 계세요?"
- "피로감이나 불편한 부분이 있으신가요?"
- A~J 체크리스트 자연스럽게 진행

3단계: USANA 소개 (10분)
- 내 이야기/스토리 공유 (1분 버전)
- 제품 소개 (문제→솔루션 구조)

4단계: 제안 및 마무리 (5분)
- 맞춤 견적 제시
- "한 번 해보실 의향이 있으세요?"
- 다음 연락 일정 잡기'
),
(
  '그룹 설명회 스크립트',
  'meeting_scenario',
  '【그룹 설명회 스크립트】

오프닝 (5분)
- "오늘 바쁘신 중에 와주셔서 감사합니다"
- 자기소개 + 오늘 agenda

건강 공감대 형성 (10분)
- "요즘 피로하신 분? 수면 안 좋으신 분?"
- 공통 건강 고민 꺼내기

USANA 소개 (15분)
- 회사 소개 (의사/과학자가 만든 뉴트리션)
- 핵심 제품 3가지
- 팀원 성공 스토리

Q&A + 개별 상담 (15분)
- 질문 받기
- 관심자 개별 상담 연결'
),
(
  '온라인 미팅 체크리스트',
  'meeting_scenario',
  '【온라인 미팅 체크리스트】

사전 준비:
□ 화면 공유 테스트
□ 체크리스트 PDF 준비
□ 견적 계산 준비

미팅 중:
□ 카메라 ON 요청
□ 화면 공유로 체크리스트 함께 보기
□ 채팅창 활용 (링크, 제품 번호 공유)

마무리:
□ 다음 연락 일정 확정
□ 카카오톡으로 요약 자료 발송'
),
(
  '팔로업 멘트 모음',
  'meeting_scenario',
  '【팔로업 멘트 모음】

미팅 후 당일:
"오늘 시간 내주셔서 감사했어요~ 궁금한 점 생기시면 편하게 연락 주세요 😊"

3일 후:
"제품 받으셨나요? 시작하면서 몸 변화 느끼시면 알려주세요!"

2주 후:
"요즘 어떠세요? 섭취하시면서 달라진 점 있으신가요?"

4주 후 (AO 안내):
"이번 달 오토쉽 날짜가 다가오고 있어요. 추가하실 제품 있으시면 알려주세요!"'
)
ON CONFLICT DO NOTHING;
-- pgvector 확장 (Supabase에서 기본 지원)
CREATE EXTENSION IF NOT EXISTS vector;

-- 문서 청크 테이블
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,  -- 'admin_file' | 'story' | 'youtube'
  source_id UUID,             -- 원본 레코드 ID
  source_name TEXT,           -- 파일명 또는 제목
  chunk_text TEXT NOT NULL,
  embedding vector(1536),     -- text-embedding-3-small 차원
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 유사도 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  source_name TEXT,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    source_name,
    chunk_text,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.document_chunks
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RLS
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_chunks_read_all" ON public.document_chunks
  FOR SELECT USING (true);
CREATE POLICY "document_chunks_admin_write" ON public.document_chunks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
-- 온보딩 필드 확장: 유사나/일반 구분, 멘토 2단계
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS member_type TEXT CHECK (member_type IN ('usana', 'general')),
  ADD COLUMN IF NOT EXISTS direct_mentor_name TEXT,
  ADD COLUMN IF NOT EXISTS direct_mentor_phone TEXT,
  ADD COLUMN IF NOT EXISTS leaders_mentor_name TEXT,
  ADD COLUMN IF NOT EXISTS leaders_mentor_phone TEXT;
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
-- conversations 테이블에 mode 컬럼 추가
-- 대화 시작 시 선택한 모드를 대화 단위로 저장
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'self'
    CHECK (mode IN ('self', 'guide'));
