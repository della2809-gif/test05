-- conversations RLS 강제 재적용
-- 기존 정책이 없거나 잘못된 경우를 대비해 DROP 후 재생성

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_raw_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own conversations" ON public.conversations;
CREATE POLICY "Users can CRUD own conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD messages in own conversations" ON public.messages;
CREATE POLICY "Users can CRUD messages in own conversations" ON public.messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can access own message raw contents" ON public.message_raw_contents;
CREATE POLICY "Users can access own message raw contents" ON public.message_raw_contents
  FOR ALL USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can access own message attachments" ON public.message_attachments;
CREATE POLICY "Users can access own message attachments" ON public.message_attachments
  FOR ALL USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.user_id = auth.uid()
    )
  );
