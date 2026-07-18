-- admin_images에 script(RAG용 설명), image_url(스토리지 공개 URL) 추가
ALTER TABLE public.admin_images ADD COLUMN IF NOT EXISTS script TEXT;
ALTER TABLE public.admin_images ADD COLUMN IF NOT EXISTS image_url TEXT;

-- admin-images 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admin-images', 'admin-images', true, 10485760, '{image/jpeg,image/png,image/gif,image/webp}')
ON CONFLICT (id) DO NOTHING;
