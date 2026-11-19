import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Megaphone, MessageCircle, MessageSquarePlus, Phone, Pin, Plus, Send, ShieldCheck, Smartphone } from 'lucide-react'
import { api } from '@/lib/api'
import type { AnnouncementRow, Contact, ThreadDetail, ThreadRow } from '@/lib/apiTypes'
import { errorMessage, useAcademics, useNotificationCounts } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { cn } from '@/lib/utils'
import type { Announcement, Role } from '@/types'
import { Avatar, Badge, Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, Tabs, useToast } from '@/components/ui'

const CHANNEL_ICON = { APP: <Megaphone className="size-3" />, EMAIL: <Mail className="size-3" />, SMS: <Phone className="size-3" />, WHATSAPP: <Smartphone className="size-3" /> }
const AUDIENCE: { role: Role; label: string }[] = [
  { role: 'STUDENT', label: 'Learners' }, { role: 'GUARDIAN', label: 'Parents / guardians' }, { role: 'FACULTY', label: 'Faculty' }, { role: 'INST_ADMIN', label: 'Administrators' },
]

export default function CommunicationPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'announcements' | 'messages') ?? 'announcements'
  const counts = useNotificationCounts()
  return (
    <>
      <PageHeader title="Communication" description="Announcements and private messages — with the right audience every time" />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={(v) => setParams({ tab: v })}
        items={[
          { value: 'announcements', label: <span className="flex items-center gap-1.5"><Megaphone className="size-4" />Announcements{counts.data?.announcements ? <Badge variant="danger">{counts.data.announcements}</Badge> : null}</span> },
          { value: 'messages', label: <span className="flex items-center gap-1.5"><MessageCircle className="size-4" />Messages{counts.data?.messages ? <Badge variant="danger">{counts.data.messages}</Badge> : null}</span> },
        ]}
      />
      {tab === 'announcements' ? <Announcements /> : <Messages />}
    </>
  )
}

function Announcements() {
  const { user } = useMe()
  const f = useFormat()
  const qc = useQueryClient()
  const [composing, setComposing] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['announcements'], queryFn: () => api.get<AnnouncementRow[]>('/announcements') })
  const read = useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/read`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['announcements'] }); void qc.invalidateQueries({ queryKey: ['notification-counts'] }) },
  })
  const canPost = user.role === 'INST_ADMIN' || user.role === 'FACULTY'

  return (
    <>
      {canPost && <div className="mb-4 flex justify-end"><Button onClick={() => setComposing(true)}><Plus />New announcement</Button></div>}
      {isLoading ? <Skeleton className="h-64" /> : !data?.length ? <Card><EmptyState icon={<Megaphone />} title="No announcements" /></Card> : (
        <div className="space-y-3">
          {data.map((a) => {
            const open = expanded === a.id
            return (
              <Card key={a.id} className={cn('p-0', !a.read && 'border-brand')}>
                <button
                  className="w-full cursor-pointer p-4 text-start"
                  onClick={() => {
                    setExpanded(open ? null : a.id)
                    if (!a.read) read.mutate(a.id)
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold">
                      {a.pinned && <Pin className="size-4 text-brand" />}
                      {!a.read && <span className="size-2 rounded-full bg-brand" aria-label="Unread" />}
                      {a.title}
                    </p>
                    <span className="text-xs text-muted-foreground">{f.date(a.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  <p className={cn('mt-1 text-sm text-muted-foreground', !open && 'line-clamp-2')}>{a.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{a.authorName}</span>
                    <span>·</span>
                    {a.audienceRoles.map((r) => <Badge key={r} variant="muted">{AUDIENCE.find((x) => x.role === r)?.label}</Badge>)}
                    {a.sectionNames.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                    <span className="ms-auto flex items-center gap-1">{a.channels.map((c) => <span key={c} title={c} className="rounded bg-muted p-1">{CHANNEL_ICON[c]}</span>)}</span>
                    {(user.role === 'INST_ADMIN' || a.authorId === user.id) && <span>· read by {a.readCount}</span>}
                  </div>
                </button>
              </Card>
            )
          })}
        </div>
      )}
      {composing && <ComposeAnnouncement onClose={() => setComposing(false)} />}
    </>
  )
}

function ComposeAnnouncement({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useMe()
  const academics = useAcademics()
  const qc = useQueryClient()
  const toast = useToast()
  const isAdmin = user.role === 'INST_ADMIN'
  const mySections = useQuery({
    queryKey: ['my-sections', user.personId],
    queryFn: () => api.get<{ slots: { sectionId: string; sectionName: string }[] }>(`/timetable?staffId=${user.personId}`),
    enabled: !isAdmin,
  })
  const sections = isAdmin
    ? academics.data?.sections.map((s) => ({ id: s.id, name: s.name })) ?? []
    : [...new Map((mySections.data?.slots ?? []).map((s) => [s.sectionId, { id: s.sectionId, name: s.sectionName }])).values()]
  const [form, setForm] = useState({ title: '', body: '', audienceRoles: (isAdmin ? ['STUDENT', 'GUARDIAN', 'FACULTY'] : ['STUDENT', 'GUARDIAN']) as Role[], sectionIds: [] as string[], channels: ['APP'] as Announcement['channels'], pinned: false })
  const m = useMutation({
    mutationFn: () => api.post('/announcements', form),
    onSuccess: () => {
      toast(`Announcement sent via ${form.channels.join(', ')}${form.channels.length > 1 ? ' (external channels simulated)' : ''}`)
      void qc.invalidateQueries({ queryKey: ['announcements'] })
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const valid = form.title && form.body && form.audienceRoles.length && (isAdmin || form.sectionIds.length)

  return (
    <Dialog open onClose={onClose} wide title="New announcement"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}><Send />Send</Button></>}>
      <div className="space-y-4">
        <Field label="Title *">{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label="Message *">{(id) => <textarea id={id} rows={5} className="w-full rounded-lg border border-border bg-card p-3 text-sm" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />}</Field>
        <div>
          <p className="mb-2 text-sm font-medium">Audience *</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE.filter((a) => isAdmin || a.role === 'STUDENT' || a.role === 'GUARDIAN').map((a) => (
              <Button key={a.role} size="sm" variant={form.audienceRoles.includes(a.role) ? 'default' : 'outline'} onClick={() => setForm({ ...form, audienceRoles: toggle(form.audienceRoles, a.role) })}>{a.label}</Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{isAdmin ? 'Limit to sections (optional — empty = whole institution)' : 'Sections *'}</p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {sections.map((s) => (
              <button key={s.id} onClick={() => setForm({ ...form, sectionIds: toggle(form.sectionIds, s.id) })} className={cn('cursor-pointer rounded-full border px-2.5 py-1 text-xs', form.sectionIds.includes(s.id) ? 'border-brand bg-brand-soft text-brand' : 'border-border hover:bg-muted')}>{s.name}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm font-medium">Channels</p>
          {(['APP', 'EMAIL', 'SMS', 'WHATSAPP'] as const).map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={form.channels.includes(c)} disabled={c === 'APP'} onChange={() => setForm({ ...form, channels: toggle(form.channels, c) })} />
              {c === 'APP' ? 'In-app' : c === 'WHATSAPP' ? 'WhatsApp' : c.charAt(0) + c.slice(1).toLowerCase()}
            </label>
          ))}
          {isAdmin && (
            <label className="ms-auto flex items-center gap-1.5 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />Pin to top
            </label>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function Messages() {
  const { user } = useMe()
  const f = useFormat()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['threads'], queryFn: () => api.get<ThreadRow[]>('/messages') })
  const current = activeId ?? data?.[0]?.id ?? null
  const minorSafe = user.role === 'STUDENT' || user.role === 'GUARDIAN'

  return (
    <>
      {minorSafe && (
        <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" />Safeguarding: messages go only to staff and are visible to school administrators if a concern is raised.</p>
      )}
      <Card className="grid min-h-[520px] overflow-hidden md:grid-cols-[300px_1fr]">
        <div className="border-b border-border md:border-b-0 md:border-e">
          <div className="flex items-center justify-between p-3">
            <p className="text-sm font-semibold">Inbox</p>
            <Button size="sm" variant="soft" onClick={() => setComposing(true)}><MessageSquarePlus />New</Button>
          </div>
          {isLoading ? <Skeleton className="m-3 h-40" /> : !data?.length ? <EmptyState title="No conversations" /> : (
            <ul className="max-h-[460px] overflow-y-auto">
              {data.map((th) => (
                <li key={th.id}>
                  <button onClick={() => setActiveId(th.id)} className={cn('flex w-full cursor-pointer gap-3 px-3 py-3 text-start hover:bg-muted', current === th.id && 'bg-brand-soft')}>
                    <Avatar name={th.with[0]?.name ?? '?'} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', th.unread ? 'font-semibold' : 'font-medium')}>{th.with.map((w) => w.name).join(', ')}</span>
                        {th.last && <span className="shrink-0 text-[11px] text-muted-foreground">{f.date(th.last.at, { day: 'numeric', month: 'short' })}</span>}
                      </span>
                      <span className="block truncate text-xs">{th.subject}</span>
                      <span className="block truncate text-xs text-muted-foreground">{th.last?.body}</span>
                    </span>
                    {th.unread > 0 && <Badge variant="danger" className="self-center">{th.unread}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {current ? <Conversation id={current} /> : <EmptyState icon={<MessageCircle />} title="Select a conversation" />}
      </Card>
      {composing && <NewMessage onClose={() => setComposing(false)} onCreated={(id) => setActiveId(id)} />}
    </>
  )
}

function Conversation({ id }: { id: string }) {
  const { user } = useMe()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const [body, setBody] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const { data } = useQuery({ queryKey: ['thread', id], queryFn: () => api.get<ThreadDetail>(`/messages/${id}`) })
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
    void qc.invalidateQueries({ queryKey: ['threads'] })
    void qc.invalidateQueries({ queryKey: ['notification-counts'] })
  }, [data?.messages.length, qc])
  const send = useMutation({
    mutationFn: () => api.post(`/messages/${id}`, { body }),
    onSuccess: () => { setBody(''); void qc.invalidateQueries({ queryKey: ['thread', id] }) },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  if (!data) return <Skeleton className="m-4 h-64" />
  const nameOf = (uid: string) => data.participants.find((p) => p.id === uid)?.name ?? '—'
  const others = data.participants.filter((p) => p.id !== user.id)
  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-border p-4">
        <p className="font-semibold">{data.subject}</p>
        <p className="text-xs text-muted-foreground">{others.map((o) => `${o.name} · ${o.title}`).join(', ')}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 400 }}>
        {data.messages.map((m) => {
          const mine = m.authorId === user.id
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-4 py-2 text-sm', mine ? 'bg-brand text-brand-foreground' : 'bg-muted')}>
                {!mine && <p className="mb-0.5 text-xs font-semibold">{nameOf(m.authorId)}</p>}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn('mt-1 text-[10px]', mine ? 'text-brand-foreground/80' : 'text-muted-foreground')}>{f.date(m.at, { dateStyle: 'short', timeStyle: 'short' })}</p>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) send.mutate() }}>
        <Input placeholder="Write a message…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
        <Button type="submit" disabled={!body.trim()} loading={send.isPending} aria-label="Send"><Send /></Button>
      </form>
    </div>
  )
}

function NewMessage({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const contacts = useQuery({ queryKey: ['contacts'], queryFn: () => api.get<Contact[]>('/messages/contacts') })
  const [form, setForm] = useState({ toUserId: '', subject: '', body: '' })
  const m = useMutation({
    mutationFn: () => api.post<{ id: string }>('/messages', form),
    onSuccess: (th) => { void qc.invalidateQueries({ queryKey: ['threads'] }); onCreated(th.id); onClose() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <Dialog open onClose={onClose} title="New message"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.toUserId || !form.subject || !form.body} loading={m.isPending} onClick={() => m.mutate()}><Send />Send</Button></>}>
      <div className="space-y-4">
        <Field label="To">{(id) => (
          <Select id={id} value={form.toUserId} onChange={(e) => setForm({ ...form, toUserId: e.target.value })}>
            <option value="">Choose…</option>
            {contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.title}</option>)}
          </Select>
        )}</Field>
        <Field label="Subject">{(id) => <Input id={id} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}</Field>
        <Field label="Message">{(id) => <textarea id={id} rows={5} className="w-full rounded-lg border border-border bg-card p-3 text-sm" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />}</Field>
      </div>
    </Dialog>
  )
}
