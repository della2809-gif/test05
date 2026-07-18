-- admin-images 스토리지 버킷 RLS 정책 추가
-- 원인: storage.objects 테이블에 정책이 없어 업로드 시 RLS 위반 에러 발생

-- 공개 읽기 (버킷이 public이므로 누구든 이미지 URL 접근 가능)
CREATE POLICY "admin_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'admin-images');

-- 어드민만 업로드 가능
CREATE POLICY "admin_images_admin_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'admin-images'
  AND auth.uid() IS NOT NULL
  AND public.is_admin()
);

-- 어드민만 수정 가능
CREATE POLICY "admin_images_admin_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'admin-images'
  AND auth.uid() IS NOT NULL
  AND public.is_admin()
);

-- 어드민만 삭제 가능
CREATE POLICY "admin_images_admin_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'admin-images'
  AND auth.uid() IS NOT NULL
  AND public.is_admin()
);
