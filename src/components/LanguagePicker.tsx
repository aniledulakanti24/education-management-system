import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Globe, Search } from 'lucide-react'
import { allLanguages } from '@/i18n/languages'
import { setLanguage } from '@/i18n'
import { Badge, Button, Dialog, Input } from './ui'
import { cn } from '@/lib/utils'

export function LanguagePicker({ compact }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const langs = useMemo(() => allLanguages(), [])
  const filtered = langs.filter((l) => !q || `${l.native} ${l.english} ${l.code}`.toLowerCase().includes(q.toLowerCase()))
  const current = langs.find((l) => l.code === i18n.language)

  return (
    <>
      <Button variant="ghost" size={compact ? 'icon' : 'sm'} onClick={() => setOpen(true)} aria-label={t('common.language')}>
        <Globe />
        {!compact && <span className="max-w-28 truncate">{current?.native ?? i18n.language}</span>}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('common.language')} description={`${langs.length} languages · bundled UI translations marked “Full”; others use English until a translation pack is installed.`} wide>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus className="ps-9" placeholder={`${t('common.search')}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid max-h-[55vh] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLanguage(l.code)
                setOpen(false)
              }}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-muted',
                i18n.language === l.code && 'bg-brand-soft',
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium" dir={l.rtl ? 'rtl' : 'ltr'}>{l.native}</span>
                <span className="block truncate text-xs text-muted-foreground">{l.english} · {l.code}{l.rtl ? ' · RTL' : ''}</span>
              </span>
              {i18n.language === l.code ? <Check className="size-4 text-brand" /> : l.translated ? <Badge variant="success">Full</Badge> : null}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  )
}
