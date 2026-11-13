# Developer certificates (Rudolf OS 1.5.9, docs/plan-1.5.9.md 8.2 in RudolfOS)

A developer from outside the project publishes apps for the Rudolf OS Library under a name prefix of their own, signed
with their own publisher key. The Library's key certifies them:

- `dev/GITHUB.cert` and `dev/GITHUB.cert.sig`: the certificate (`rpk-cert 1`: name, GitHub account, public key, name
  prefix, expiry) and the Library key's signature. Made by the workflow **Certify a developer** (Actions › Certify a
  developer › Run workflow), which opens a pull request with them; merging it publishes them at
  `https://merciless146.github.io/rudolfos-library/dev/GITHUB.cert`.
- The developer builds their package with it: `rpk-tool.py build PKGDIR OUT.rpk --key THEIR.key --cert GITHUB.cert`
  (the `.sig` beside it). Rudolf OS accepts it only for the desktop (in the app sandbox), only under the prefix, and
  only while the certificate is valid.
- **Revocation:** a line in `revoked.txt` at the top of this repository, `key PUBLICKEY` (a developer) or
  `pkg NAME VERSION` (`*` for every version). It goes into the signed package list, and every Rudolf OS computer turns
  those apps off at its next check.
- A developer's first package, and any that asks for new permissions, is reviewed in a pull request before it is
  listed.
