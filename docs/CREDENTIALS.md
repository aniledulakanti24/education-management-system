# UnifiedTree Credentials — design

Phase 3b turns every certificate, badge and transcript into a **verifiable digital credential**. Anyone can check one in seconds without contacting the institution, and nobody can forge or quietly alter one.

## What ships in this build

| Piece | Where | Notes |
|---|---|---|
| Credential templates | `src/mocks/handlers-phase3b.ts` (`TEMPLATES`, `buildVc`) | Progress report, grade card / transcript, course completion, Star Attendance badge, bonafide / enrolment letter, doctoral milestone |
| Signing | `src/lib/vc.ts` | Real cryptography via WebCrypto: JSON canonicalisation (RFC 8785 style), SHA-256, ECDSA P-256, multibase base58btc proof value |
| Issuer identity | `GET /api/public/did/:subdomain` | `did:web:<subdomain>.unifiedtree.app` DID document with the public key (JWK) |
| Revocation | `GET /api/public/status/:subdomain` | Each credential has a status-list index; revoked indexes are published |
| Anchoring ledger | `GET /api/public/ledger` | Hash-chained log of `ISSUE` / `REVOKE` events. It stores **only hashes**: no names, marks or IDs |
| Verifier | `/verify`, `/verify/:id`, `src/lib/verify.ts` | Runs fully in the verifier's browser: format → issuer DID → signature → revocation → validity period → ledger anchor and chain integrity |
| Wallet | `/wallet` | Learners and parents view, print, download (`.vc.json`) and share credentials, and can make any credential private |
| Admin console | `/credentials` | Issue in bulk with eligibility checks; revoke with a reason; push to DigiLocker; view the credit bank, issuer key and ledger |
| Credit bank | `/credentials` → Credit bank, `/wallet` | Academic Bank of Credits (India) or ECTS (Bologna). Deposits are allowed only after final results are published. Shows NEP 2020 multiple entry/exit milestones (40 / 80 / 120 / 160 credits) or ECTS award thresholds |

## Standards

- **W3C Verifiable Credentials Data Model 2.0.** Every credential has `@context`, `type`, `issuer`, `validFrom`, `credentialSubject` and `credentialStatus`.
- **W3C Data Integrity, cryptosuite `ecdsa-jcs-2019`.** The proof is computed over hash(canonical proof config) ‖ hash(canonical document).
- **did:web.** In production the DID document is served at `https://<subdomain>.unifiedtree.app/.well-known/did.json`.
- **Bitstring Status List** (`BitstringStatusListEntry`). The demo publishes revoked indexes as JSON. Production publishes the compressed bitstring as a signed status-list credential.
- **1EdTech Open Badges 3.0** for badges and course completions (`OpenBadgeCredential`, `Achievement`).
- **India:** APAAR ID as the subject identifier when present (`urn:apaar:…`); ABC ID on higher-education credentials; DigiLocker / NAD push.

## Privacy rules

- Credentials carry only what the purpose needs. Date of birth, address, phone, caste/category and health data are **never** included.
- Learners without an APAAR ID get a pseudonymous subject ID (`urn:unifiedtree:learner:<id>`).
- The holder controls sharing. A private credential's link and QR code stop resolving publicly.
- The ledger holds hashes only, so it can be shared with partner institutions or a consortium network without exposing personal data.
- Revocation reasons stay in the institution's audit log. Verifiers only learn that a credential is revoked.

## Production checklist

1. Keep issuer private keys in an HSM or cloud KMS (one key per tenant, rotation via new `#key-N` entries in the DID document). The demo keeps keys in browser storage.
2. Anchor the ledger to a permissioned network (e.g. Hyperledger Fabric run with partner universities), or periodically publish the ledger head hash to a public timestamping service.
3. Connect to production APIs. All three need institutional registration.
   - ABC / NAD credit deposits through the APAAR / ABC partner API, with OAuth client credentials.
   - DigiLocker issuer push, with the issuer ID and document type registered with DigiLocker.
   - Europass Digital Credentials (EDC) export for European partners.
4. Add OpenID for Verifiable Credential Issuance (OID4VCI), so learners can import credentials into third-party wallets (e.g. EU Digital Identity Wallet). Add OpenID4VP for presentation requests from employers.
5. Add a degree-award workflow (exam board approval → convocation → degree credential), which needs the final-semester results flow.
