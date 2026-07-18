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
