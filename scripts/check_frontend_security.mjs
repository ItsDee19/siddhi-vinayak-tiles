import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'dist')
// Deliberately report the rule and file only; never echo a potential credential.
const signatures = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['Stripe secret key', /\bsk_live_[A-Za-z0-9]{20,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{35}\b/],
]
let checked = 0
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) { await scan(path); continue }
    assert.ok(!/^\.env(?:\.|$)/i.test(entry.name), `Environment file in public build: ${relative(dist, path)}`)
    if (!/\.(?:js|mjs|html|css|json|map|txt|pem|key)$/i.test(entry.name)) continue
    const contents = await readFile(path, 'utf8')
    for (const [label, pattern] of signatures) {
      assert.ok(!pattern.test(contents), `Potential ${label} in ${relative(dist, path)}; inspect privately`)
    }
    if (entry.name.endsWith('.html')) {
      assert.ok(!/<script\b[^>]*\bsrc=["']https?:\/\//i.test(contents), `Unexpected third-party script in ${relative(dist, path)}`)
      assert.ok(!/fonts\.(?:googleapis|gstatic)\.com/.test(contents), `External fonts in ${relative(dist, path)}`)
    }
    checked++
  }
}
await scan(dist)
console.log(`Frontend security check: ${checked} text assets scanned; no matched credential signatures, public env files or third-party scripts. This is a scoped build check, not a full security audit.`)
