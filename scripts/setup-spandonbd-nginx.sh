#!/bin/bash
set -euo pipefail

cat > /etc/nginx/sites-available/spandonbd.com <<'NGINX'
server {
    listen 80;
    server_name spandonbd.com www.spandonbd.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location = /downloads/BloodLink.apk {
        root /var/www/blood-assets;
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition "attachment; filename=BloodLink.apk";
        add_header Cache-Control "public, max-age=3600";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/spandonbd.com /etc/nginx/sites-enabled/spandonbd.com
nginx -t
systemctl reload nginx

echo "HTTP check:"
curl -s -o /dev/null -w "spandonbd.com HTTP %{http_code}\n" -H "Host: spandonbd.com" http://127.0.0.1/
curl -s -o /dev/null -w "www HTTP %{http_code}\n" -H "Host: www.spandonbd.com" http://127.0.0.1/

certbot --nginx -d spandonbd.com -d www.spandonbd.com --non-interactive --agree-tos --register-unsafely-without-email --redirect

nginx -t
systemctl reload nginx

echo "=== VERIFY ==="
curl -sI https://spandonbd.com | head -15
echo "---"
curl -sI https://www.spandonbd.com | head -10
echo "DONE"
