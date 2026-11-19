import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Award, BadgeCheck, Copy, Download, ExternalLink, Printer, ShieldAlert } from 'lucide-react'
import type { CredentialDetail } from '@/lib/apiTypes'
import { useFormat } from '@/lib/session'
import { appHostPath, appUrl, cn } from '@/lib/utils'
import { Badge, Button, useToast } from './ui'

type Subject = Record<string, unknown> & {
  name?: string; programme?: string; section?: string; admissionNo?: string; academicTerm?: string
  results?: { course: string; percent: number; grade: string }[]
  courses?: { code: string; title: string; credits: number; grade: string }[]
  achievement?: { name: string; description: string; criteria?: { narrative: string } }
}

export const verifyUrl = (id: string) => appUrl(`/verify/${id}`)

export function CertificateView({ c }: { c: CredentialDetail }) {
  const f = useFormat()
  const toast = useToast()
  const [qr, setQr] = useState('')
  const vc = c.vc
  const s = vc.credentialSubject as Subject
  const url = verifyUrl(c.id)
  const badge = vc.type.includes('OpenBadgeCredential')
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''))
  }, [url])
  const extras = Object.entries(s).filter(([k, v]) => !['id', 'type', 'name', 'programme', 'section', 'admissionNo', 'academicTerm', 'results', 'courses', 'achievement', 'assessments'].includes(k) && v !== null && v !== undefined && typeof v !== 'object')
  const label = (k: string) => /^[A-Z]+$/.test(k) ? k : k.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase()).replace('Sgpa', 'SGPA').replace('Cgpa', 'CGPA').replace('Gpa', 'GPA').replace('Abc', 'ABC')

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(vc, null, 2)], { type: 'application/vc+json' }))
    a.download = `${c.id}.vc.json`
    a.click()
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer />Print / PDF</Button>
        <Button variant="outline" size="sm" onClick={download}><Download />Download credential (.json)</Button>
        <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(url); toast('Verification link copied') }}><Copy />Copy verify link</Button>
        <a href={url} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><ExternalLink />Open verifier</Button></a>
      </div>
      <div className={cn('print-area relative overflow-hidden rounded-2xl border-4 border-double p-6 sm:p-8', c.status === 'REVOKED' ? 'border-danger' : 'border-brand')}>
        {c.status === 'REVOKED' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 rounded-xl border-4 border-danger px-6 py-2 text-4xl font-black uppercase tracking-widest text-danger opacity-60">Revoked</span>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">{vc.issuer.name}</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold">{badge ? <Award className="size-6 text-warning" /> : <BadgeCheck className="size-6 text-brand" />}{vc.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.academicTerm ?? ''}</p>
          </div>
          {qr && <img src={qr} alt="QR code linking to the verification page" className="size-28 rounded-lg bg-white p-1" />}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">This certifies that</p>
        <p className="text-xl font-semibold">{s.name}</p>
        <p className="text-sm text-muted-foreground">{[s.programme, s.section, s.admissionNo].filter(Boolean).join(' · ')}</p>

        {s.achievement && (
          <div className="mt-4 rounded-xl bg-warning/10 p-4">
            <p className="font-semibold">{s.achievement.name}</p>
            <p className="text-sm">{s.achievement.description}</p>
            {s.achievement.criteria && <p className="mt-1 text-xs text-muted-foreground">Criteria: {s.achievement.criteria.narrative}</p>}
          </div>
        )}
        {s.results && (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-xs uppercase text-muted-foreground"><th className="py-1 text-start">Subject</th><th className="text-end">%</th><th className="text-end">Grade</th></tr></thead>
            <tbody>{s.results.map((r) => <tr key={r.course} className="border-t border-border"><td className="py-1.5">{r.course}</td><td className="text-end tabular-nums">{r.percent}</td><td className="text-end font-medium">{r.grade}</td></tr>)}</tbody>
          </table>
        )}
        {s.courses && (
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-xs uppercase text-muted-foreground"><th className="py-1 text-start">Code</th><th className="text-start">Course</th><th className="text-end">Credits</th><th className="text-end">Grade</th></tr></thead>
            <tbody>{s.courses.map((r) => <tr key={r.code} className="border-t border-border"><td className="py-1.5 font-mono text-xs">{r.code}</td><td>{r.title}</td><td className="text-end tabular-nums">{r.credits}</td><td className="text-end font-medium">{r.grade}</td></tr>)}</tbody>
          </table>
        )}
        {extras.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {extras.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{label(k)}</dt><dd className="font-medium">{String(v)}</dd></div>)}
          </dl>
        )}

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
          <div className="space-y-0.5">
            <p>Issued {f.date(c.issuedAt, { dateStyle: 'long' })} by {c.issuedBy}{vc.validUntil ? ` · valid until ${f.date(vc.validUntil)}` : ''}</p>
            <p className="font-mono">{vc.issuer.id}</p>
            <p>Credential ID {c.id}{c.ledgerIndex !== null ? ` · ledger block #${c.ledgerIndex}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">W3C VC 2.0</Badge>
            {badge && <Badge variant="outline">Open Badges 3.0</Badge>}
            <Badge variant="outline">ecdsa-jcs-2019</Badge>
            {c.digilocker && <Badge variant="success">DigiLocker</Badge>}
          </div>
        </div>
        {c.status === 'REVOKED' && <p className="mt-3 flex items-center gap-1.5 text-sm text-danger"><ShieldAlert className="size-4" />Revoked {c.revokedAt ? f.date(c.revokedAt) : ''}: {c.revokeReason}</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">Scan the QR code or visit {appHostPath('/verify')} to check this certificate. The digital file is the original; a printed copy is only valid if it verifies.</p>
      </div>
    </div>
  )
}
