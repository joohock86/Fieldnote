from pathlib import Path
import zipfile
root = Path(__file__).resolve().parents[1]
output = root / 'dist'
output.mkdir(exist_ok=True)
with zipfile.ZipFile(output / 'fieldnote-cloudflare-deploy.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['index.html', 'config.js', 'supabase.js', 'photo-compression.js', 'maintenance.js', 'maintenance-ui.js', '_headers']:
        archive.write(root / 'cloudflare' / name, name)
print('Created dist/fieldnote-cloudflare-deploy.zip')
