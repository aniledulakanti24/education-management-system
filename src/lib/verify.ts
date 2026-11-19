// Independent credential verification, run entirely in the verifier's browser.
// It trusts only public material: the issuer's DID document, its revocation list and the public ledger.
import { blockHash, credentialHash, verifySignature } from './vc'
import { API_BASE } from './api'
import type { LedgerBlock } from '@/types'

export type StepStatus = 'pass' | 'fail' | 'warn'
export interface VerifyStep { key: string; label: string; status: StepStatus; detail: string }
export interface VerifyResult { valid: boolean; steps: VerifyStep[]; issuerName?: string }

const getJson = async <T,>(path: string): Promise<T> => {
  const r = await fetch(`${API_BASE}/api/public${path}`)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { message?: string }).message ?? r.statusText)
  return data as T
}

export async function verifyCredential(input: unknown): Promise<VerifyResult> {
  const steps: VerifyStep[] = []
  const add = (key: string, label: string, status: StepStatus, detail: string) => steps.push({ key, label, status, detail })
  const done = (issuerName?: string) => ({ valid: steps.every((s) => s.status !== 'fail'), steps, issuerName })

  // 1. structure
  const vc = input as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const structural = vc && typeof vc === 'object' && Array.isArray(vc['@context']) && vc['@context'][0] === 'https://www.w3.org/ns/credentials/v2'
    && Array.isArray(vc.type) && vc.type.includes('VerifiableCredential') && typeof vc.issuer?.id === 'string' && vc.credentialSubject && vc.proof
  if (!structural) {
    add('format', 'W3C Verifiable Credential format', 'fail', 'This is not a W3C VC 2.0 credential with a proof.')
    return done()
  }
  add('format', 'W3C Verifiable Credential format', 'pass', `${vc.type.filter((x: string) => x !== 'VerifiableCredential').join(', ') || 'Credential'} · ${vc.proof.cryptosuite}`)

  // 2. issuer identity (did:web)
  const m = /^did:web:([a-z0-9-]+)\.unifiedtree\.app$/.exec(vc.issuer.id)
  if (!m) {
    add('issuer', 'Issuer identity', 'fail', `Unknown issuer ${vc.issuer.id}`)
    return done()
  }
  let did: { name: string; verificationMethod: { id: string; publicKeyJwk: JsonWebKey }[] }
  try {
    did = await getJson(`/did/${m[1]}`)
  } catch (e) {
    add('issuer', 'Issuer identity', 'fail', `Could not resolve ${vc.issuer.id}: ${(e as Error).message}`)
    return done()
  }
  const method = did.verificationMethod.find((v) => v.id === vc.proof.verificationMethod)
  if (!method) {
    add('issuer', 'Issuer identity', 'fail', 'The signing key is not listed in the issuer’s DID document.')
    return done(did.name)
  }
  add('issuer', 'Issuer identity', 'pass', `${did.name} — ${vc.issuer.id}`)

  // 3. signature
  const sig = await verifySignature(vc, method.publicKeyJwk)
  add('signature', 'Digital signature', sig.ok ? 'pass' : 'fail', sig.ok ? 'ECDSA P-256 signature is valid; the content is exactly as issued.' : sig.reason ?? 'Invalid signature')

  // 4. revocation
  try {
    const status = await getJson<{ revoked: number[] }>(`/status/${m[1]}`)
    const idx = Number(vc.credentialStatus?.statusListIndex)
    const revoked = status.revoked.includes(idx)
    add('status', 'Not revoked', revoked ? 'fail' : 'pass', revoked ? 'The issuer has revoked this credential.' : `Status list entry #${idx} is clear.`)
  } catch {
    add('status', 'Not revoked', 'warn', 'Could not reach the issuer’s status list.')
  }

  // 5. validity period
  const now = Date.now()
  if (vc.validFrom && Date.parse(vc.validFrom) > now) add('validity', 'Validity period', 'fail', 'Not yet valid.')
  else if (vc.validUntil && Date.parse(vc.validUntil) < now) add('validity', 'Validity period', 'fail', `Expired on ${new Date(vc.validUntil).toLocaleDateString()}.`)
  else add('validity', 'Validity period', 'pass', vc.validUntil ? `Valid until ${new Date(vc.validUntil).toLocaleDateString()}.` : 'Does not expire.')

  // 6. ledger anchor
  try {
    const { blocks } = await getJson<{ blocks: LedgerBlock[] }>('/ledger')
    const credId = String(vc.id).split('/').pop()
    const block = blocks.find((b) => b.action === 'ISSUE' && b.credentialId === credId)
    if (!block) add('ledger', 'Anchored on ledger', 'fail', 'No issuance record for this credential on the ledger.')
    else {
      const hashOk = block.credentialHash === (await credentialHash(vc))
      let chainOk = true
      for (let i = Math.max(1, block.index); i < blocks.length; i++) {
        if (blocks[i].prevHash !== blocks[i - 1].hash || (await blockHash(blocks[i])) !== blocks[i].hash) {
          chainOk = false
          break
        }
      }
      add('ledger', 'Anchored on ledger', hashOk && chainOk ? 'pass' : 'fail',
        !hashOk ? 'The credential differs from the version anchored at issuance.' : !chainOk ? 'Ledger chain integrity check failed.' : `Block #${block.index} · hash-chain intact to block #${blocks.length - 1}.`)
    }
  } catch {
    add('ledger', 'Anchored on ledger', 'warn', 'Ledger unavailable — signature check still applies.')
  }
  return done(did.name)
}
