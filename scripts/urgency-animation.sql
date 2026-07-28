-- Run in Supabase SQL Editor if migration not applied
-- Admin-managed critical / urgent blood droplet backdrop animation

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS urgency_animation JSONB NOT NULL DEFAULT '{
    "critical": {
      "enabled": true,
      "mode": "breathe",
      "duration_ms": 2200,
      "opacity_min": 0.06,
      "opacity_max": 0.2,
      "scale_min": 0.82,
      "scale_max": 1.18,
      "size_percent": 72,
      "droplet_count": 1,
      "easing": "ease-in-out",
      "color": "#C62828",
      "show_header_icon": true
    },
    "urgent": {
      "enabled": true,
      "mode": "pulse-glow",
      "duration_ms": 2800,
      "opacity_min": 0.04,
      "opacity_max": 0.14,
      "scale_min": 0.88,
      "scale_max": 1.1,
      "size_percent": 64,
      "droplet_count": 1,
      "easing": "ease-in-out",
      "color": "#E67E22",
      "show_header_icon": false
    }
  }'::jsonb;
