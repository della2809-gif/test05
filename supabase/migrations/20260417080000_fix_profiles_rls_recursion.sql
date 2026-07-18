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
