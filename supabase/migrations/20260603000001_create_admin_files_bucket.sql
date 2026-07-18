-- admin-files 스토리지 버킷 생성
-- (admin-images와 동일한 방식, 버킷 생성이 누락되어 파일 업로드 실패 수정)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-files',
  'admin-files',
  false,
  10485760,
  '{application/pdf,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet}'
)
ON CONFLICT (id) DO NOTHING;
