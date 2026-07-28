-- Allow users to delete their own chat messages

GRANT DELETE ON public.messages TO authenticated;

DROP POLICY IF EXISTS "msg_delete_sender" ON public.messages;
CREATE POLICY "msg_delete_sender" ON public.messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);
