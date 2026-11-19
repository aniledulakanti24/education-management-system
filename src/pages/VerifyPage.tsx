import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, CheckCircle2, CircleAlert, FlaskConical, Loader2, ShieldCheck, ShieldX, Upload, XCircle } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import { verifyCredential, type VerifyResult } from '@/lib/verify'
import { cn } from '@/lib/utils'
import type { VerifiableCredential } from '@/types'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { LanguagePicker } from '@/components/LanguagePicker'
import { ThemeToggle } from '@/components/AppShell'

/** Public verification portal: /verify and /verify/:id — no account needed. */
export default function VerifyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [idInput, setIdInput] = useState(id ?? '')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [vc, setVc] = useState<VerifiableCredential | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (doc: unknown) => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setVc(doc as VerifiableCredential)
      setResult(await verifyCredential(doc))
    } finally {
      setBusy(false)
    }
  }

  const loadById = async (credId: string) => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const r = await fetch(`${API_BASE}/api/public/credentials/${encodeURIComponent(credId.trim())}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.message ?? 'Not found')
      setText(JSON.stringify(data.vc, null, 2))
      await run(data.vc)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  useEffect(() => {
    if (id) void loadById(id)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fromText = () => {
    try {
      void run(JSON.parse(text))
    } catch {
      setError('That is not valid JSON. Paste the full credential file (.json).')
    }
  }
  const tamper = () => {
    try {
      const doc = JSON.parse(text)
      const s = doc.credentialSubject ?? {}
      if (Array.isArray(s.results) && s.results[0]) s.results[0].grade = 'A1'
      else if (Array.isArray(s.courses) && s.courses[0]) s.courses[0].grade = 'O'
      else s.name = `${s.name ?? ''} (edited)`
      const t = JSON.stringify(doc, null, 2)
      setText(t)
      void run(doc)
    } catch {
      setError('Load a credential first.')
    }
  }
  const onFile = async (file?: File) => {
    if (!file) return
    const t = await file.text()
    setText(t)
    try {
      await run(JSON.parse(t))
    } catch {
      setError('The file is not a valid credential.')
    }
  }
  const subject = (vc?.credentialSubject ?? {}) as Record<string, unknown>

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link to="/verify" className="flex items-center gap-2" onClick={() => { setResult(null); setText(''); setVc(null); setIdInput('') }}>
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-white"><ShieldCheck className="size-5" /></div>
          <span className="font-semibold">UnifiedTree Verify</span>
        </Link>
        <div className="flex gap-1"><LanguagePicker compact /><ThemeToggle /></div>
      </header>
      <main className="mx-auto max-w-4xl space-y-4 px-4 pb-16">
        <div>
          <h1 className="text-2xl font-semibold">Verify an academic credential</h1>
          <p className="mt-1 text-sm text-muted-foreground">Checks the issuer’s digital signature, revocation status and ledger anchor right here in your browser. No sign-in, nothing is stored.</p>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (idInput.trim()) navigate(`/verify/${encodeURIComponent(idInput.trim())}`) }}>
              <Input className="min-w-60 flex-1" placeholder="Credential ID or link, e.g. cred-gps-0012" value={idInput} onChange={(e) => setIdInput(e.target.value.split('/').pop() ?? '')} aria-label="Credential ID" />
              <Button type="submit" disabled={!idInput.trim()}>Look up</Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">— or paste / upload the credential file —</p>
            <textarea rows={6} aria-label="Credential JSON" className="w-full rounded-lg border border-border bg-card p-3 font-mono text-xs" placeholder='{"@context": ["https://www.w3.org/ns/credentials/v2"], …}' value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={fromText} disabled={!text.trim()}><ShieldCheck />Verify</Button>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
                <Upload className="size-4" />Upload .json
                <input type="file" accept=".json,application/json,application/vc+json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
              {text && <Button variant="ghost" onClick={tamper}><FlaskConical />Try tampering</Button>}
            </div>
            {error && <p className="flex items-center gap-2 text-sm text-danger"><CircleAlert className="size-4" />{error}</p>}
          </CardContent>
        </Card>

        {busy && <Card className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin text-brand" />Checking signature, status and ledger…</Card>}

        {result && (
          <Card className={cn('overflow-hidden', result.valid ? 'border-success' : 'border-danger')}>
            <div className={cn('flex items-center gap-3 p-5', result.valid ? 'bg-success/12' : 'bg-danger/12')}>
              {result.valid ? <BadgeCheck className="size-8 text-success" /> : <ShieldX className="size-8 text-danger" />}
              <div>
                <p className={cn('text-lg font-semibold', result.valid ? 'text-success' : 'text-danger')}>{result.valid ? 'Authentic and valid' : 'Not valid'}</p>
                <p className="text-sm">{vc?.name}{result.issuerName ? ` · issued by ${result.issuerName}` : ''}</p>
              </div>
            </div>
            <CardContent className="grid gap-6 pt-5 md:grid-cols-2">
              <ul className="space-y-3">
                {result.steps.map((s) => (
                  <li key={s.key} className="flex gap-3 text-sm">
                    {s.status === 'pass' ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : s.status === 'fail' ? <XCircle className="size-5 shrink-0 text-danger" /> : <CircleAlert className="size-5 shrink-0 text-warning" />}
                    <span><span className="font-medium">{s.label}</span><span className="block text-xs text-muted-foreground">{s.detail}</span></span>
                  </li>
                ))}
              </ul>
              <div>
                <CardHeader className="p-0 pb-2"><CardTitle className="text-sm">Credential contents</CardTitle></CardHeader>
                <dl className="space-y-1.5 text-sm">
                  {['name', 'programme', 'section', 'academicTerm', 'overallGrade', 'overallPercent', 'totalCredits', 'SGPA', 'CGPA', 'GPA', 'milestone', 'enrolmentStatus', 'attendancePercent'].filter((k) => subject[k] !== undefined && subject[k] !== null).map((k) => (
                    <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{/^[A-Z]+$/.test(k) ? k : k.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase())}</dt><dd className="text-end font-medium">{String(subject[k])}</dd></div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap gap-1.5">{vc?.type.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                <p className="mt-3 text-xs text-muted-foreground">Issued {vc?.validFrom ? new Date(vc.validFrom).toLocaleDateString() : '—'} · {String((vc?.issuer as { id?: string })?.id ?? '')}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <p className="text-center text-xs text-muted-foreground">Standards: W3C Verifiable Credentials 2.0 · Data Integrity ecdsa-jcs-2019 · did:web · Bitstring Status List · 1EdTech Open Badges 3.0</p>
      </main>
    </div>
  )
}
