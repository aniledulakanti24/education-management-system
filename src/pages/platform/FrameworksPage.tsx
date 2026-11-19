import { useTranslation } from 'react-i18next'
import { FRAMEWORKS } from '@/lib/frameworks'
import { useFormat } from '@/lib/session'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@/components/ui'

export default function FrameworksPage() {
  const { t } = useTranslation()
  const f = useFormat()
  return (
    <>
      <PageHeader title={t('nav.frameworks')} description="Curriculum, grading, credit and reporting rules expressed as data. New countries are added as packs, not code forks." />
      <div className="grid gap-4 md:grid-cols-2">
        {Object.values(FRAMEWORKS).map((p) => (
          <Card key={p.code}>
            <CardHeader>
              <div>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.region} · academic year starts {f.date(`2025-${String(p.academicYearStartMonth).padStart(2, '0')}-01`, { month: 'long' })}</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono">{p.code}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-1.5">{p.levels.map((l) => <Badge key={l}>{t(`levels.${l}`)}</Badge>)}</div>
              <p><span className="text-muted-foreground">Grading: </span>{p.gradingScheme}</p>
              <div className="flex flex-wrap gap-1">{p.gradeBands.map((b) => <Badge key={b.label} variant="muted">{b.label} ≥{b.min}</Badge>)}</div>
              <p><span className="text-muted-foreground">Credits: </span>{p.creditSystem}</p>
              <p><span className="text-muted-foreground">Reports: </span>{p.reports.join(' · ')}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
