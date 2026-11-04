# catalog.json for the App Store's Library tab: each app's title, icon, summary, description, category, licence,
# version, download size and installed size. Read from apps/*/PKGINFO and the built packages. GPL-2.0-or-later.
#   catalog.py APPS_DIR SITE_DIR
import json, os, sys, hashlib
apps, site = sys.argv[1], sys.argv[2]
def info(p):
    d = {}
    for l in open(p, encoding='utf-8'):
        if '=' in l and not l.lstrip().startswith('#'):
            k, v = l.split('=', 1); d[k.strip()] = v.strip()
    return d
out = []
for n in sorted(os.listdir(apps)):
    p = os.path.join(apps, n, 'PKGINFO')
    if not os.path.isfile(p): continue
    i = info(p); rpk = os.path.join(site, i['name'] + '.rpk')
    if not os.path.isfile(rpk): sys.exit(f'catalog: {rpk} was not built')
    inst = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(os.path.join(apps, n, 'www')) for f in fs)
    src = os.path.join('source', i['name'] + '-' + i['version'] + '-src.tar.xz')
    out.append({k: i.get(k, '') for k in ('name', 'version', 'kind', 'title', 'summary', 'description', 'icon', 'category', 'license', 'homepage')}
               | {'download': os.path.getsize(rpk), 'installed': inst, 'sha256': hashlib.sha256(open(rpk, 'rb').read()).hexdigest(),
                  'source': src if os.path.isfile(os.path.join(site, src)) else ''})
json.dump({'catalog': 1, 'apps': out}, open(os.path.join(site, 'catalog.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'catalog.json: {len(out)} apps')
