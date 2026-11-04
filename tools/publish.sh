#!/bin/sh
# Build every app in apps/ into a signed package and write the signed index and the catalog into SITE.
#   tools/publish.sh KEYFILE SITE [SERIAL]
# KEYFILE: the Library's private key (raw base64, after keycheck.py). Packages are reproducible (fixed times and owners),
# so an unchanged app gives the same bytes, and computers do not download it again. GPL-2.0-or-later.
set -e
KEY=$1; SITE=$2; SERIAL=${3:-$(date -u +%Y%m%d%H%M)}
HERE=$(cd "$(dirname "$0")" && pwd); TOP=$HERE/..
mkdir -p "$SITE/source"
for a in "$TOP"/apps/*/; do
	n=$(basename "$a"); v=$(sed -n 's/^version *= *//p' "$a/PKGINFO")
	T=$(mktemp -d); cp "$a/PKGINFO" "$T/"; cp -r "$a/www" "$T/www"
	python3 "$HERE/rpk-tool.py" build "$T" "$SITE/$n.rpk" --key "$KEY"
	rm -rf "$T"
	# the corresponding source of compiled programs, published next to the package (GPL)
	[ -d "$a/source" ] && for s in "$a"/source/*.tar.xz; do cp "$s" "$SITE/source/$n-$v-src.tar.xz"; done
done
python3 "$HERE/rpk-tool.py" index "$SITE" --key "$KEY" --serial "$SERIAL"
python3 "$HERE/catalog.py" "$TOP/apps" "$SITE"
cp "$TOP/keys.txt" "$SITE/keys.txt"
