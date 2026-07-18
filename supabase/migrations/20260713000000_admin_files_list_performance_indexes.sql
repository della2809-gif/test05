-- Hotfix: speed up /admin/files metadata list, category filter, filename search,
-- and detail/delete lookups for reference file chunks.
-- No data changes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_admin_files_created_at_desc
  ON public.admin_files (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_files_category_created_at
  ON public.admin_files (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_files_file_name_trgm
  ON public.admin_files USING gin (file_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_admin_file_source
  ON public.document_chunks (source_type, source_id, created_at);
