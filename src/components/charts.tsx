import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Categorical palette chosen for distinguishability in light and dark themes.
export const SERIES = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#7c3aed', '#0891b2', '#ea580c', '#64748b']

const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--foreground)',
}
const axis = { fontSize: 11, fill: 'var(--muted-foreground)' }

export function TrendChart({ data, format }: { data: { label: string; value: number | null }[]; format?: (n: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis domain={[50, 100]} tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [format ? format(Number(v)) : `${v}%`, 'Attendance']} />
        <Area type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2} fill="url(#trendFill)" connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function HBarChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={130} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)' }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="var(--brand)" barSize={18} name="Count" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Donut({ data, height = 200, format }: { data: { label: string; value: number }[]; height?: number; format?: (n: number) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div style={{ width: height, height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="60%" outerRadius="95%" paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-medium tabular-nums">{format ? format(d.value) : d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ColumnChart({ data, format, name = 'Value' }: { data: { label: string; value: number }[]; format?: (n: number) => string; name?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => (format ? format(Number(v)) : String(v))} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)' }} formatter={(v) => [format ? format(Number(v)) : v, name]} />
        <Bar dataKey="value" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={28} name={name} />
      </BarChart>
    </ResponsiveContainer>
  )
}
