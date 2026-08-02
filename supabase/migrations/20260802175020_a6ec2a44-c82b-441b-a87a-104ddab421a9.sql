
CREATE POLICY "Users manage their own chat uploads"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can read chat uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-uploads' AND public.has_role(auth.uid(), 'admin'));
