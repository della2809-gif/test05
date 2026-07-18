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
