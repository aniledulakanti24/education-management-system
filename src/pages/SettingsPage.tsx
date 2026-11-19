import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { FRAMEWORKS } from '@/lib/frameworks'
import { errorMessage } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { allLanguages } from '@/i18n/languages'
import { cn } from '@/lib/utils'
import type { Tenant } from '@/types'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, PageHeader, Select, useToast } from '@/components/ui'

const PRESETS = ['#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#0891b2', '#db2777', '#0d9488', '#4f46e5', '#ca8a04']

export default function SettingsPage() {
  const { t } = useTranslation()
  const { tenant } = useMe()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<Pick<Tenant, 'name' | 'shortName' | 'brandColor' | 'defaultLanguage' | 'weekDays' | 'city'>>({
    name: tenant!.name, shortName: tenant!.shortName, brandColor: tenant!.brandColor, defaultLanguage: tenant!.defaultLanguage, weekDays: tenant!.weekDays, city: tenant!.city,
  })
  const pack = FRAMEWORKS[tenant!.framework]
  const save = useMutation({
    mutationFn: () => api.patch(`/tenants/${tenant!.id}`, form),
    onSuccess: () => {
      toast('Settings saved')
      void qc.invalidateQueries()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })

  return (
    <>
      <PageHeader title={t('nav.settings')} description="Institution profile, branding and locale." actions={<Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Institution</CardTitle><CardDescription>{tenant!.subdomain}.unifiedtree.app</CardDescription></div></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Short name">{(id) => <Input id={id} maxLength={5} value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value.toUpperCase() })} />}</Field>
            <Field label="City">{(id) => <Input id={id} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />}</Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Branding</CardTitle><CardDescription>Applied across all portals and the mobile app.</CardDescription></div></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((c) => (
                <button key={c} aria-label={c} onClick={() => setForm({ ...form, brandColor: c })}
                  className={cn('size-9 cursor-pointer rounded-full ring-offset-2 ring-offset-card', form.brandColor === c && 'ring-2 ring-foreground')} style={{ background: c }} />
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="color" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} className="size-9 cursor-pointer rounded-full border-0 bg-transparent" />
                Custom
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex size-10 items-center justify-center rounded-xl font-bold text-white" style={{ background: form.brandColor }}>{form.shortName.slice(0, 2)}</div>
              <span className="font-medium">{form.name}</span>
              <span className="ms-auto rounded-lg px-3 py-1.5 text-sm text-white" style={{ background: form.brandColor }}>Preview</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Locale</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Default language for new users">{(id) => (
              <Select id={id} value={form.defaultLanguage} onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}>
                {allLanguages().map((l) => <option key={l.code} value={l.code}>{l.english} — {l.native}{l.translated ? ' ✓' : ''}</option>)}
              </Select>
            )}</Field>
            <div>
              <p className="mb-2 text-sm font-medium">Working days</p>
              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const on = form.weekDays.includes(d)
                  return (
                    <Button key={d} size="sm" variant={on ? 'default' : 'outline'} onClick={() => setForm({ ...form, weekDays: on ? form.weekDays.filter((x) => x !== d) : [...form.weekDays, d].sort() })}>
                      {f.weekday(d)}
                    </Button>
                  )
                })}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Currency {tenant!.currency} · Time zone {tenant!.timezone} · Sample {f.money(125000)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div><CardTitle>Framework pack</CardTitle><CardDescription>Managed by the platform operator.</CardDescription></div>
            <Lock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium">{pack.name}</p>
            <p className="text-muted-foreground">{pack.gradingScheme}</p>
            <div className="flex flex-wrap gap-1.5">{tenant!.levels.map((l) => <Badge key={l}>{t(`levels.${l}`)}</Badge>)}</div>
            <p><span className="text-muted-foreground">Regulatory reports: </span>{pack.reports.join(', ')}</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
