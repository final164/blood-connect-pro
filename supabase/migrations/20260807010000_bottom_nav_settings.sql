-- Bottom / top app nav visibility (feed, community, post, alert, profile)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS bottom_nav_settings JSONB NOT NULL DEFAULT '{
    "items": [
      {"id":"feed","enabled":true,"order":0,"label_bn":"ফিড","label_en":"Feed"},
      {"id":"community","enabled":true,"order":1,"label_bn":"কমিউনিটি","label_en":"Community"},
      {"id":"post","enabled":true,"order":2,"label_bn":"পোস্ট","label_en":"Post"},
      {"id":"alert","enabled":true,"order":3,"label_bn":"অ্যালার্ট","label_en":"Alert"},
      {"id":"profile","enabled":true,"order":4,"label_bn":"প্রোফাইল","label_en":"Profile"}
    ]
  }'::jsonb;
