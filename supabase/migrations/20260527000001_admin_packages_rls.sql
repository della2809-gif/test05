-- BUG-C01: admin_packages RLS 설정
ALTER TABLE public.admin_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read packages" ON public.admin_packages;
CREATE POLICY "Anyone can read packages"
  ON public.admin_packages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage packages" ON public.admin_packages;
CREATE POLICY "Admins can manage packages"
  ON public.admin_packages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
