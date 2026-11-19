import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, RotateCcw, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { FRAMEWORKS } from '@/lib/frameworks'
import type { Tenant, User } from '@/types'
import { Avatar, Badge, Button, Card, Skeleton, useToast } from '@/components/ui'
import { LanguagePicker } from '@/components/LanguagePicker'
import { ThemeToggle } from '@/components/AppShell'

const TYPE_LABEL: Record<Tenant['type'], string> = { SCHOOL: 'K-12 School', COLLEGE: 'Engineering College', UNIVERSITY: 'Research University', TRAINING: 'Training Institute' }

export default function LoginPage() {
  const { t } = useTranslation()
  const { signIn } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['demo-users'], queryFn: () => api.get<{ tenants: Tenant[]; users: User[] }>('/demo-users') })

  const tenantsWithUsers = data?.tenants.filter((tn) => data.users.some((u) => u.tenantId === tn.id)) ?? []
  const superUser = data?.users.find((u) => u.role === 'SUPER_ADMIN')
  const selected = data?.tenants.find((x) => x.id === tenantId)
  const tenantUsers = data?.users.filter((u) => u.tenantId === tenantId) ?? []

  async function enter(u: User) {
    setBusy(u.id)
    try {
      await signIn(u.id)
      navigate('/')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand font-bold text-white">UT</div>
          <span className="font-semibold">{t('app.name')}</span>
        </div>
        <div className="flex items-center gap-1">
          <LanguagePicker />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="py-8 sm:py-12">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{t('app.tagline')}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t('login.subtitle')}</p>
        </section>

        {isLoading && <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>}

        {data && !selected && (
          <>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('login.chooseInstitution')}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {tenantsWithUsers.filter((x) => x.id !== 'platform').map((tn) => (
                <button key={tn.id} onClick={() => setTenantId(tn.id)} className="cursor-pointer text-start">
                  <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: tn.brandColor }}>{tn.shortName}</div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{tn.name}</p>
                        <p className="text-sm text-muted-foreground">{tn.city} · {TYPE_LABEL[tn.type]}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <Badge variant="muted">{FRAMEWORKS[tn.framework].name}</Badge>
                      {tn.levels.map((l) => <Badge key={l} variant="outline">{t(`levels.${l}`)}</Badge>)}
                    </div>
                    <p className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: tn.brandColor }}>
                      {t('login.chooseRole')} <ArrowRight className="size-4 rtl:rotate-180" />
                    </p>
                  </Card>
                </button>
              ))}
            </div>

            {superUser && (
              <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-muted p-3"><ShieldCheck className="size-5" /></div>
                  <div>
                    <p className="font-semibold">{t('login.platform')}</p>
                    <p className="text-sm text-muted-foreground">Manage all institutions, regions, framework packs and languages.</p>
                  </div>
                </div>
                <Button onClick={() => enter(superUser)} loading={busy === superUser.id}>
                  {superUser.name} <ArrowRight className="rtl:rotate-180" />
                </Button>
              </Card>
            )}
          </>
        )}

        {selected && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setTenantId(null)} className="mb-4">
              <ArrowLeft className="rtl:rotate-180" /> {t('common.back')}
            </Button>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl font-bold text-white" style={{ background: selected.brandColor }}><Building2 className="size-5" /></div>
              <div>
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{t('login.chooseRole')}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tenantUsers.map((u) => (
                <button key={u.id} onClick={() => enter(u)} disabled={!!busy} className="cursor-pointer text-start disabled:opacity-60">
                  <Card className="flex items-center gap-3 p-4 transition hover:shadow-md">
                    <Avatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{u.title}</p>
                    </div>
                    <Badge variant={u.role === 'INST_ADMIN' ? 'default' : u.role === 'FACULTY' ? 'info' : u.role === 'STUDENT' ? 'success' : 'warning'}>
                      {t(`roles.${u.role}`)}
                    </Badge>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          <Link to="/verify"><Button variant="ghost" size="sm"><BadgeCheck /> Verify a certificate</Button></Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await api.post('/reset')
              await qc.invalidateQueries()
              toast(t('login.resetDone'))
            }}
          >
            <RotateCcw /> {t('login.reset')}
          </Button>
        </div>
      </main>
    </div>
  )
}
