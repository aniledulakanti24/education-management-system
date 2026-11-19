// Verifiable-credential cryptography shared by the issuer (mock backend) and the verifier (browser).
// Implements W3C Data Integrity with the `ecdsa-jcs-2019` cryptosuite:
//   JSON Canonicalization (RFC 8785, JCS) → SHA-256 of proof config ‖ SHA-256 of document → ECDSA P-256,
//   proofValue = multibase base58btc ("z…") of the 64-byte IEEE-P1363 signature.
// Uses only WebCrypto, so the same code runs in any modern browser or server runtime.

/** RFC 8785-style canonical JSON: object keys sorted by UTF-16 code units, no whitespace. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite numbers cannot be canonicalised')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).filter((k) => obj[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`
}

const enc = new TextEncoder()

export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof data === 'string' ? enc.encode(data) : data
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

export const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')

// ---- base58btc (Bitcoin alphabet), used by multibase "z" ----
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function base58encode(bytes: Uint8Array): string {
  let n = 0n
  for (const b of bytes) n = n * 256n + BigInt(b)
  let out = ''
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out
    n /= 58n
  }
  for (const b of bytes) {
    if (b !== 0) break
    out = '1' + out
  }
  return out
}
export function base58decode(s: string): Uint8Array {
  let n = 0n
  for (const c of s) {
    const i = ALPHABET.indexOf(c)
    if (i < 0) throw new Error('Invalid base58 character')
    n = n * 58n + BigInt(i)
  }
  const bytes: number[] = []
  while (n > 0n) {
    bytes.unshift(Number(n % 256n))
    n /= 256n
  }
  for (const c of s) {
    if (c !== '1') break
    bytes.unshift(0)
  }
  return new Uint8Array(bytes)
}

export interface IssuerKey { publicJwk: JsonWebKey; privateJwk: JsonWebKey; createdAt: string }

export async function generateIssuerKey(): Promise<IssuerKey> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return {
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    createdAt: new Date().toISOString(),
  }
}

type Doc = Record<string, unknown>

async function hashData(doc: Doc, proofConfig: Doc) {
  const { proof: _ignored, ...unsecured } = doc
  void _ignored
  const a = await sha256(canonicalize(proofConfig))
  const b = await sha256(canonicalize(unsecured))
  const out = new Uint8Array(64)
  out.set(a, 0)
  out.set(b, 32)
  return out
}

export async function signCredential<T extends Doc>(doc: T, privateJwk: JsonWebKey, verificationMethod: string, created = new Date().toISOString()): Promise<T & { proof: Doc }> {
  const proofConfig = {
    '@context': doc['@context'],
    type: 'DataIntegrityProof',
    cryptosuite: 'ecdsa-jcs-2019',
    created,
    verificationMethod,
    proofPurpose: 'assertionMethod',
  }
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, await hashData(doc, proofConfig)))
  const { '@context': _ctx, ...proofWithoutContext } = proofConfig
  void _ctx
  return { ...doc, proof: { ...proofWithoutContext, proofValue: 'z' + base58encode(sig) } }
}

export async function verifySignature(doc: Doc, publicJwk: JsonWebKey): Promise<{ ok: boolean; reason?: string }> {
  const proof = doc.proof as Doc | undefined
  if (!proof) return { ok: false, reason: 'The credential has no proof' }
  if (proof.type !== 'DataIntegrityProof' || proof.cryptosuite !== 'ecdsa-jcs-2019') return { ok: false, reason: `Unsupported proof type ${String(proof.cryptosuite ?? proof.type)}` }
  const proofValue = String(proof.proofValue ?? '')
  if (!proofValue.startsWith('z')) return { ok: false, reason: 'proofValue is not multibase base58btc' }
  const { proofValue: _pv, ...rest } = proof
  void _pv
  const proofConfig = { '@context': doc['@context'], ...rest }
  try {
    const key = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, base58decode(proofValue.slice(1)) as BufferSource, await hashData(doc, proofConfig))
    return ok ? { ok } : { ok, reason: 'The signature does not match — the credential was altered or was not issued by this institution' }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Signature check failed' }
  }
}

/** Hash of a ledger block: binds the index, time, action, credential hash and the previous block. */
export async function blockHash(b: { index: number; at: string; action: string; issuerDid: string; credentialId: string; credentialHash: string; prevHash: string }) {
  return toHex(await sha256(canonicalize({ index: b.index, at: b.at, action: b.action, issuerDid: b.issuerDid, credentialId: b.credentialId, credentialHash: b.credentialHash, prevHash: b.prevHash })))
}

export const credentialHash = async (vc: Doc) => toHex(await sha256(canonicalize(vc)))
