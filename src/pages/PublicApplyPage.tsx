import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, GraduationCap } from 'lucide-react'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/queries'
import type { LevelCode } from '@/types'
import { Button, Card, EmptyState, Field, Input, Select, Skeleton } from '@/components/ui'
import { LanguagePicker } from '@/components/LanguagePicker'
import { ThemeToggle } from '@/components/AppShell'

interface PublicInfo {
  tenant: { name: string; city: string; country: string; brandColor: string; shortName: string; type: string }
  programs: { id: string; name: string; level: LevelCode }[]
}

/** Public, unauthenticated admission form: /apply/:subdomain */
export default function PublicApplyPage() {
  const { subdomain } = useParams()
  const { data, isLoading, error } = useQuery({ queryKey: ['public', subdomain], queryFn: () => api.get<PublicInfo>(`/public/institutions/${subdomain}`) })
  const [form, setForm] = useState({ applicantName: '', dob: '', gender: 'F', programId: '', guardianName: '', phone: '', email: '', previousSchool: '', consent: false })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }))
  const m = useMutation({ mutationFn: () => api.post<{ number: string }>(`/public/institutions/${subdomain}/apply`, form) })
  const brand = data?.tenant.brandColor ?? '#0d9488'
  const valid = form.applicantName && form.dob && form.programId && form.phone && form.email && form.consent

  return (
    <div className="min-h-screen bg-background" style={{ ['--brand' as string]: brand }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">{data?.tenant.shortName.slice(0, 3) ?? '…'}</div>
          <span className="font-semibold">{data?.tenant.name}</span>
        </div>
        <div className="flex gap-1"><LanguagePicker compact /><ThemeToggle /></div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        {isLoading ? <Skeleton className="h-96" /> : error || !data ? <Card><EmptyState title="Institution not found" /></Card> : m.isSuccess ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <h1 className="mt-4 text-2xl font-semibold">Application submitted</h1>
            <p className="mt-2 text-muted-foreground">Your application number is</p>
            <p className="mt-1 font-mono text-lg font-semibold">{m.data.number}</p>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">The admissions office at {data.tenant.name} will contact you on the phone number and email you provided with the next steps and document checklist.</p>
          </Card>
        ) : (
          <>
            <h1 className="mt-4 flex items-center gap-2 text-2xl font-semibold"><GraduationCap className="size-6 text-brand" />Apply for admission</h1>
            <p className="mb-6 mt-1 text-muted-foreground">{data.tenant.name}, {data.tenant.city}</p>
            <Card className="p-5">
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (valid) m.mutate() }}>
                <Field label="Applicant’s full name *">{(id) => <Input id={id} autoComplete="name" value={form.applicantName} onChange={set('applicantName')} required />}</Field>
                <Field label="Programme / class applying for *">{(id) => (
                  <Select id={id} value={form.programId} onChange={set('programId')} required>
                    <option value="">Choose…</option>
                    {data.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                )}</Field>
                <Field label="Date of birth *">{(id) => <Input id={id} type="date" value={form.dob} onChange={set('dob')} required />}</Field>
                <Field label="Gender">{(id) => <Select id={id} value={form.gender} onChange={set('gender')}><option value="F">Female</option><option value="M">Male</option><option value="X">Prefer not to say</option></Select>}</Field>
                <Field label="Parent / guardian name (for minors)">{(id) => <Input id={id} value={form.guardianName} onChange={set('guardianName')} />}</Field>
                <Field label="Previous school / institution">{(id) => <Input id={id} value={form.previousSchool} onChange={set('previousSchool')} />}</Field>
                <Field label="Phone *">{(id) => <Input id={id} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} required />}</Field>
                <Field label="Email *">{(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} required />}</Field>
                <label className="flex items-start gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={form.consent} onChange={(e) => setForm((x) => ({ ...x, consent: e.target.checked }))} />
                  <span>I consent to {data.tenant.name} processing this information for admission purposes. For applicants under 18, I confirm I am the parent or legal guardian.</span>
                </label>
                {m.isError && <p className="text-sm text-danger sm:col-span-2">{errorMessage(m.error)}</p>}
                <div className="sm:col-span-2">
                  <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!valid} loading={m.isPending}>Submit application</Button>
                </div>
              </form>
            </Card>
            <p className="mt-4 text-center text-xs text-muted-foreground">Powered by UnifiedTree · demo mode — no data leaves your browser</p>
          </>
        )}
      </main>
    </div>
  )
}
