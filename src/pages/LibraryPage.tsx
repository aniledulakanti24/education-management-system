import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, BookPlus, BookUp, Library, RotateCcw, Search, TriangleAlert } from 'lucide-react'
import { api, qs } from '@/lib/api'
import type { BookRow, LearnerRow, LoanRow } from '@/lib/apiTypes'
import { errorMessage } from '@/lib/queries'
import { useFormat, useMe } from '@/lib/session'
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, StatCard, Table, Tabs, Td, Th, useToast } from '@/components/ui'

type Tab = 'catalogue' | 'issued' | 'overdue' | 'history'

export default function LibraryPage() {
  const { user } = useMe()
  return user.role === 'INST_ADMIN' ? <LibraryDesk /> : <MyLibrary />
}

function useBooks(q: string, category: string) {
  return useQuery({ queryKey: ['books', q, category], queryFn: () => api.get<BookRow[]>(`/library/books${qs({ q, category })}`) })
}

function LibraryDesk() {
  const { t } = useTranslation()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('catalogue')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [issueBook, setIssueBook] = useState<BookRow | null>(null)
  const [adding, setAdding] = useState(false)
  const books = useBooks(q, category)
  const allBooks = useBooks('', '')
  const loans = useQuery({
    queryKey: ['loans', tab],
    queryFn: () => api.get<LoanRow[]>(`/library/loans${qs({ status: tab === 'overdue' ? 'overdue' : tab === 'history' ? 'all' : 'active' })}`),
    enabled: tab !== 'catalogue',
  })
  const active = useQuery({ queryKey: ['loans', 'issued'], queryFn: () => api.get<LoanRow[]>('/library/loans?status=active') })
  const ret = useMutation({
    mutationFn: (id: string) => api.post<LoanRow>(`/library/loans/${id}/return`),
    onSuccess: (l) => {
      toast(`Returned${l.fine ? ` · fine ${f.money(l.fine)} collected` : ''}`)
      void qc.invalidateQueries({ queryKey: ['loans'] })
      void qc.invalidateQueries({ queryKey: ['books'] })
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const categories = useMemo(() => [...new Set(allBooks.data?.map((b) => b.category))].sort(), [allBooks.data])
  const copies = allBooks.data?.reduce((a, b) => a + b.copies, 0) ?? 0
  const overdue = active.data?.filter((l) => l.overdueDays > 0).length ?? 0

  return (
    <>
      <PageHeader title="Library" description="Catalogue, circulation and fines" actions={<Button onClick={() => setAdding(true)}><BookPlus />Add title</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Titles" value={allBooks.data?.length ?? '—'} icon={<Library />} />
        <StatCard label="Copies" value={copies} icon={<BookOpen />} tone="info" />
        <StatCard label="Issued now" value={active.data?.length ?? '—'} icon={<BookUp />} tone="success" />
        <StatCard label="Overdue" value={overdue} icon={<TriangleAlert />} tone="danger" />
      </div>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'catalogue', label: 'Catalogue' }, { value: 'issued', label: 'Issued' }, { value: 'overdue', label: `Overdue (${overdue})` }, { value: 'history', label: 'History' }]} />
        {tab === 'catalogue' && (
          <>
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="ps-9" placeholder="Title, author or ISBN…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
            </div>
            <Select className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">{t('common.all')} — categories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </>
        )}
      </div>

      <Card>
        {tab === 'catalogue' ? (
          books.isLoading ? <Skeleton className="m-4 h-64" /> : !books.data?.length ? <EmptyState title={t('common.noData')} /> : (
            <Table>
              <thead><tr><Th>Title</Th><Th>Category</Th><Th>Shelf</Th><Th className="text-end">Available</Th><Th /></tr></thead>
              <tbody>
                {books.data.map((b) => (
                  <tr key={b.id}>
                    <Td><p className="font-medium">{b.title}</p><p className="text-xs text-muted-foreground">{b.author} · {b.year} · ISBN {b.isbn}</p></Td>
                    <Td><Badge variant="muted">{b.category}</Badge></Td>
                    <Td className="font-mono text-xs">{b.shelf}</Td>
                    <Td className="text-end"><Badge variant={b.available ? 'success' : 'danger'}>{b.available} / {b.copies}</Badge></Td>
                    <Td className="text-end"><Button size="sm" variant="soft" disabled={!b.available} onClick={() => setIssueBook(b)}>Issue</Button></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        ) : loans.isLoading ? <Skeleton className="m-4 h-64" /> : !loans.data?.length ? <EmptyState title={t('common.noData')} /> : (
          <Table>
            <thead><tr><Th>Book</Th><Th>Borrower</Th><Th>Issued</Th><Th>Due</Th><Th className="text-end">Fine</Th><Th /></tr></thead>
            <tbody>
              {loans.data.map((l) => (
                <tr key={l.id}>
                  <Td><p className="font-medium">{l.bookTitle}</p><p className="text-xs text-muted-foreground">{l.bookAuthor}</p></Td>
                  <Td><p>{l.borrowerName}</p><p className="text-xs text-muted-foreground">{l.borrowerSection}</p></Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{f.date(l.issuedOn)}</Td>
                  <Td className="whitespace-nowrap">{f.date(l.dueOn)}{l.active && l.overdueDays > 0 && <Badge variant="danger" className="ms-2">{l.overdueDays}d late</Badge>}{!l.active && <Badge variant="muted" className="ms-2">returned</Badge>}</Td>
                  <Td className="text-end tabular-nums">{l.fine ? f.money(l.fine) : '—'}</Td>
                  <Td className="text-end">{l.active && <Button size="sm" variant="outline" loading={ret.isPending && ret.variables === l.id} onClick={() => ret.mutate(l.id)}><RotateCcw />Return</Button>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {issueBook && <IssueDialog book={issueBook} onClose={() => setIssueBook(null)} />}
      {adding && <AddBookDialog onClose={() => setAdding(false)} />}
    </>
  )
}

function IssueDialog({ book, onClose }: { book: BookRow; onClose: () => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const qc = useQueryClient()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [borrowerId, setBorrowerId] = useState('')
  const [days, setDays] = useState(14)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(id)
  }, [q])
  const learners = useQuery({
    queryKey: ['learners', 'lib', debounced],
    queryFn: () => api.get<{ items: LearnerRow[] }>(`/learners${qs({ q: debounced, pageSize: 8, status: 'ACTIVE' })}`),
    enabled: debounced.length >= 2,
  })
  const due = new Date()
  due.setDate(due.getDate() + days)
  const m = useMutation({
    mutationFn: () => api.post('/library/loans', { bookId: book.id, borrowerId, days }),
    onSuccess: () => {
      toast(`Issued “${book.title}” — due ${f.date(due.toISOString())}`)
      void qc.invalidateQueries({ queryKey: ['loans'] })
      void qc.invalidateQueries({ queryKey: ['books'] })
      onClose()
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  return (
    <Dialog open onClose={onClose} title={`Issue “${book.title}”`} description={`${book.available} of ${book.copies} copies available`}
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!borrowerId} loading={m.isPending} onClick={() => m.mutate()}>Issue book</Button></>}>
      <div className="space-y-4">
        <Field label="Find learner (name or admission no.)">{(id) => <Input id={id} autoFocus value={q} onChange={(e) => { setQ(e.target.value); setBorrowerId('') }} />}</Field>
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {learners.data?.items.map((l) => (
            <li key={l.id}>
              <button onClick={() => setBorrowerId(l.id)} className={`flex w-full cursor-pointer justify-between rounded-lg border px-3 py-2 text-start text-sm ${borrowerId === l.id ? 'border-brand bg-brand-soft' : 'border-border hover:bg-muted'}`}>
                <span>{l.firstName} {l.lastName}</span><span className="text-xs text-muted-foreground">{l.sectionName} · {l.admissionNo}</span>
              </button>
            </li>
          ))}
        </ul>
        <Field label="Loan period">{(id) => <Select id={id} value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></Select>}</Field>
        <p className="text-xs text-muted-foreground">Rules: max 3 books per learner; no new issue while a book is overdue.</p>
      </div>
    </Dialog>
  )
}

function AddBookDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', author: '', isbn: '', category: '', copies: 1, shelf: '', year: new Date().getFullYear() })
  const m = useMutation({
    mutationFn: () => api.post('/library/books', form),
    onSuccess: () => { toast('Title catalogued'); void qc.invalidateQueries({ queryKey: ['books'] }); onClose() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Dialog open onClose={onClose} title="Add a title" description="MARC21 / Koha import and RFID tagging arrive with the full library module."
      footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!form.title || !form.author} loading={m.isPending} onClick={() => m.mutate()}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title *" className="sm:col-span-2">{(id) => <Input id={id} value={form.title} onChange={set('title')} />}</Field>
        <Field label="Author *">{(id) => <Input id={id} value={form.author} onChange={set('author')} />}</Field>
        <Field label="ISBN">{(id) => <Input id={id} value={form.isbn} onChange={set('isbn')} />}</Field>
        <Field label="Category">{(id) => <Input id={id} value={form.category} onChange={set('category')} />}</Field>
        <Field label="Shelf">{(id) => <Input id={id} value={form.shelf} onChange={set('shelf')} />}</Field>
        <Field label="Copies">{(id) => <Input id={id} type="number" min={1} value={form.copies} onChange={set('copies')} />}</Field>
        <Field label="Year">{(id) => <Input id={id} type="number" value={form.year} onChange={set('year')} />}</Field>
      </div>
    </Dialog>
  )
}

function MyLibrary() {
  const { t } = useTranslation()
  const f = useFormat()
  const [q, setQ] = useState('')
  const loans = useQuery({ queryKey: ['loans', 'mine'], queryFn: () => api.get<LoanRow[]>('/library/loans?status=active') })
  const books = useBooks(q, '')
  return (
    <>
      <PageHeader title="Library" description="Books you have borrowed and the catalogue" />
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">On loan</h2>
      {loans.isLoading ? <Skeleton className="h-24" /> : !loans.data?.length ? <Card className="mb-6"><EmptyState icon={<BookOpen />} title="No books on loan" /></Card> : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loans.data.map((l) => (
            <Card key={l.id} className="p-4">
              <p className="font-medium">{l.bookTitle}</p>
              <p className="text-xs text-muted-foreground">{l.bookAuthor}{loans.data.some((x) => x.borrowerId !== l.borrowerId) ? ` · ${l.borrowerName}` : ''}</p>
              <p className="mt-2 text-sm">Due {f.date(l.dueOn)} {l.overdueDays > 0 ? <Badge variant="danger">{l.overdueDays} days late · fine {f.money(l.fine)}</Badge> : <Badge variant="success">On time</Badge>}</p>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Catalogue</h2>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="ps-9" placeholder="Search title or author…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
      </div>
      <Card>
        <Table>
          <thead><tr><Th>Title</Th><Th>Category</Th><Th className="text-end">Available</Th></tr></thead>
          <tbody>
            {books.data?.map((b) => (
              <tr key={b.id}>
                <Td><p className="font-medium">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p></Td>
                <Td><Badge variant="muted">{b.category}</Badge></Td>
                <Td className="text-end">{b.available ? <Badge variant="success">Shelf {b.shelf}</Badge> : <Badge variant="muted">All out</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
