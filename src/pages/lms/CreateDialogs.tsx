import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/queries'
import { Button, Dialog, Field, Input, Select, useToast } from '@/components/ui'

function useInvalidate(sectionId: string, courseId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['lms-class', sectionId, courseId] })
    void qc.invalidateQueries({ queryKey: ['lms-classes'] })
  }
}

export function NewLessonDialog({ sectionId, courseId, modules, onClose }: { sectionId: string; courseId: string; modules: string[]; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const refresh = useInvalidate(sectionId, courseId)
  const [form, setForm] = useState({ module: modules.find((m) => m !== 'Getting started') ?? 'Unit 1', title: '', kind: 'ARTICLE', body: '', url: '', minutes: 10 })
  const m = useMutation({
    mutationFn: () => api.post('/lms/lessons', { ...form, sectionId, courseId }),
    onSuccess: () => { toast('Lesson published — learners can see it now'); refresh(); onClose() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <Dialog open onClose={onClose} wide title="Publish a lesson"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.title || !(form.body || form.url)} loading={m.isPending} onClick={() => m.mutate()}>Publish</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Unit / module" className="sm:col-span-2">{(id) => <Input id={id} list="modules" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} />}</Field>
        <datalist id="modules">{modules.map((m) => <option key={m} value={m} />)}</datalist>
        <Field label="Type">{(id) => <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="ARTICLE">Reading</option><option value="VIDEO">Video</option><option value="LINK">External resource</option></Select>}</Field>
        <Field label="Title *" className="sm:col-span-2">{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label="Minutes">{(id) => <Input id={id} type="number" min={1} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} />}</Field>
        <Field label="Lesson text" className="sm:col-span-3" hint="The AI tutor answers learner questions from this text, so clear explanations make it more helpful.">{(id) => (
          <textarea id={id} rows={8} className="w-full rounded-lg border border-border bg-card p-3 text-sm" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        )}</Field>
        {form.kind !== 'ARTICLE' && <Field label="Link (video or resource URL)" className="sm:col-span-3">{(id) => <Input id={id} type="url" placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />}</Field>}
      </div>
    </Dialog>
  )
}

export function NewLiveDialog({ sectionId, courseId, onClose }: { sectionId: string; courseId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const refresh = useInvalidate(sectionId, courseId)
  const tomorrow = new Date(Date.now() + 864e5)
  tomorrow.setHours(16, 0, 0, 0)
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const [form, setForm] = useState({ title: '', startsAt: local, minutes: 45 })
  const m = useMutation({
    mutationFn: () => api.post('/lms/live', { ...form, sectionId, courseId }),
    onSuccess: () => { toast('Live class scheduled — the class gets a reminder'); refresh(); onClose() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <Dialog open onClose={onClose} title="Schedule a live class"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.title} loading={m.isPending} onClick={() => m.mutate()}>Schedule</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title *" className="sm:col-span-2">{(id) => <Input id={id} placeholder="e.g. Doubt-clearing session" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label="Starts at">{(id) => <Input id={id} type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />}</Field>
        <Field label="Duration (minutes)">{(id) => <Input id={id} type="number" min={15} step={15} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} />}</Field>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">A private Jitsi Meet room link is generated automatically.</p>
    </Dialog>
  )
}
