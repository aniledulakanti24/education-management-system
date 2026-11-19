import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { allLanguages } from '@/i18n/languages'
import { resources } from '@/i18n/resources'
import { setLanguage } from '@/i18n'
import { Badge, Button, Card, Input, PageHeader, Progress, StatCard, Table, Td, Th } from '@/components/ui'

type Dict = { [k: string]: string | Dict }
const countKeys = (d: Dict): number => Object.values(d).reduce<number>((a, v) => a + (typeof v === 'string' ? 1 : countKeys(v)), 0)

export default function LanguagesPage() {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const langs = useMemo(() => allLanguages(), [])
  const total = countKeys(resources.en.translation as Dict)
  const coverage = (code: string) => {
    const r = (resources as Record<string, { translation: Dict }>)[code]
    return r ? Math.round((countKeys(r.translation) / total) * 100) : 0
  }
  const list = langs.filter((l) => !q || `${l.english} ${l.native} ${l.code}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader title={t('nav.languages')} description="Every ISO 639-1 language is selectable. Untranslated strings fall back to English until a translation pack is installed." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Languages available" value={langs.length} />
        <StatCard label="Bundled UI translations" value={langs.filter((l) => l.translated).length} tone="success" />
        <StatCard label="Right-to-left scripts" value={langs.filter((l) => l.rtl).length} tone="info" />
      </div>
      <Card>
        <div className="relative p-4">
          <Search className="pointer-events-none absolute start-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" placeholder={`${t('common.search')}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
        <Table>
          <thead><tr><Th>Language</Th><Th>Code</Th><Th>Direction</Th><Th className="w-56">UI coverage</Th><Th /></tr></thead>
          <tbody>
            {list.map((l) => {
              const c = coverage(l.code)
              return (
                <tr key={l.code}>
                  <Td><p className="font-medium" dir={l.rtl ? 'rtl' : 'ltr'}>{l.native}</p><p className="text-xs text-muted-foreground">{l.english}</p></Td>
                  <Td className="font-mono text-xs">{l.code}</Td>
                  <Td>{l.rtl ? <Badge variant="info">RTL</Badge> : <span className="text-muted-foreground">LTR</span>}</Td>
                  <Td>
                    {c > 0 ? (
                      <div className="flex items-center gap-2"><Progress value={c} tone={c >= 90 ? 'success' : 'warning'} /><span className="w-10 text-xs tabular-nums">{c}%</span></div>
                    ) : <span className="text-xs text-muted-foreground">English fallback · pack available on request</span>}
                  </Td>
                  <Td><Button size="sm" variant="ghost" onClick={() => setLanguage(l.code)}>Use</Button></Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
