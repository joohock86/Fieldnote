from pathlib import Path
import re,zipfile
root=Path(__file__).resolve().parents[1];s=(root/'cloudflare/index.html').read_text()
s=re.sub(r"@import url\('https://fonts.googleapis.com/[^']+'\);",'',s)
s=s.replace('<title>Fieldnote · Field service workspace</title>','<title>Fieldnote · Offline maintenance preview</title>')
s=s.replace('<script src="config.js"></script>','').replace('<script src="supabase.js"></script>','<script>'+ (root/'offline-adapter.js').read_text()+'</script>')
for name in ['maintenance.js','maintenance-ui.js']:
 s=re.sub(r'<script src="'+re.escape(name)+r'"(?: defer)?></script>',lambda m:'<script>'+(root/'cloudflare'/name).read_text()+'</script>',s)
s=s.replace('class="auth-screen"','class="auth-screen hidden"').replace('id="workspace" class="shell hidden"','id="workspace" class="shell"')
s=s.replace('<span id="user-name">Service team</span><button id="signout" class="secondary">Sign out</button>','<span id="user-name">Offline preview</span>')
s=s.replace('Shared service records for your team.','Test records saved in this browser.').replace('Shared database · service history','Offline · this browser only')
s=s.replace('<article>','<article><div class="note" style="margin:0 0 25px"><div><b>Offline preview — test without deploying</b><p>Records and photos stay in this browser. This copy does not read or change your live Supabase data.</p></div></div>')
start=s.index('async function boot(){');end=s.index('</script>',start)
s=s[:start]+'''async function boot(){await load();}
'''+s[end:]
assert 'https://bvnkwwypmdxdcumyxyne.supabase.co' not in s
assert '<script src=' not in s
assert '@import' not in s
(root/'fieldnote-maintenance-offline.html').write_text(s)

with zipfile.ZipFile(root/'fieldnote-maintenance-offline.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write(root/'fieldnote-maintenance-offline.html','fieldnote-maintenance-offline.html')
print('Standalone HTML and ZIP created; no external resources or Supabase connection.')
