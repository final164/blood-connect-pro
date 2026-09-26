from pathlib import Path
print(Path("/etc/nginx/sites-enabled/spandonbd.com").read_text())
