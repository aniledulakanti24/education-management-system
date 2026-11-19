import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BookOpen, CalendarDays, ClipboardCheck, FlaskConical, Globe2, GraduationCap, Layers, LayoutDashboard, LogOut, Menu,
  Moon, ScrollText, Settings, Sparkles, Sun, Users, Building2, X, UserCircle2,
  Award, FileSpreadsheet, Library, MessagesSquare, UserPlus, Wallet, MonitorPlay, BrainCircuit, BadgeCheck,
} from 'lucide-react'
import { useMe, useSession } from '@/lib/session'
import { useNotificationCounts } from '@/lib/queries'
import { AssistantLauncher } from './AssistantLauncher'
import type { Role, Tenant } from '@/types'
import { Avatar, Badge, Button } from './ui'
import { LanguagePicker } from './LanguagePicker'
import { cn } from '@/lib/utils'

interface NavItem { to: string; key: string; icon: ReactNode; show?: (t: Tenant | null) => boolean; badge?: boolean }

const hasResearch = (t: Tenant | null) => !!t?.levels.includes('PHD')

const NAV: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { to: '/', key: 'nav.dashboard', icon: <LayoutDashboard /> },
    { to: '/platform/tenants', key: 'nav.tenants', icon: <Building2 /> },
    { to: '/platform/frameworks', key: 'nav.frameworks', icon: <Layers /> },
    { to: '/platform/languages', key: 'nav.languages', icon: <Globe2 /> },
    { to: '/audit', key: 'nav.audit', icon: <ScrollText /> },
    { to: '/roadmap', key: 'nav.roadmap', icon: <Sparkles /> },
  ],
  INST_ADMIN: [
    { to: '/', key: 'nav.dashboard', icon: <LayoutDashboard /> },
    { to: '/admissions', key: 'nav.admissions', icon: <UserPlus /> },
    { to: '/learners', key: 'nav.learners', icon: <GraduationCap /> },
    { to: '/staff', key: 'nav.staff', icon: <Users /> },
    { to: '/academics', key: 'nav.academics', icon: <BookOpen /> },
    { to: '/timetable', key: 'nav.timetable', icon: <CalendarDays /> },
    { to: '/attendance', key: 'nav.attendance', icon: <ClipboardCheck /> },
    { to: '/exams', key: 'nav.exams', icon: <FileSpreadsheet /> },
    { to: '/learn', key: 'nav.learn', icon: <MonitorPlay /> },
    { to: '/insights', key: 'nav.insights', icon: <BrainCircuit /> },
    { to: '/fees', key: 'nav.fees', icon: <Wallet /> },
    { to: '/credentials', key: 'nav.credentials', icon: <BadgeCheck /> },
    { to: '/communication', key: 'nav.communication', icon: <MessagesSquare />, badge: true },
    { to: '/library', key: 'nav.library', icon: <Library /> },
    { to: '/research', key: 'nav.research', icon: <FlaskConical />, show: hasResearch },
    { to: '/settings', key: 'nav.settings', icon: <Settings /> },
    { to: '/audit', key: 'nav.audit', icon: <ScrollText /> },
    { to: '/roadmap', key: 'nav.roadmap', icon: <Sparkles /> },
  ],
  FACULTY: [
    { to: '/', key: 'nav.dashboard', icon: <LayoutDashboard /> },
    { to: '/timetable', key: 'nav.myTimetable', icon: <CalendarDays /> },
    { to: '/attendance', key: 'nav.attendance', icon: <ClipboardCheck /> },
    { to: '/learn', key: 'nav.myClasses', icon: <MonitorPlay /> },
    { to: '/exams', key: 'nav.gradebook', icon: <FileSpreadsheet /> },
    { to: '/insights', key: 'nav.insights', icon: <BrainCircuit /> },
    { to: '/learners', key: 'nav.learners', icon: <GraduationCap /> },
    { to: '/communication', key: 'nav.communication', icon: <MessagesSquare />, badge: true },
    { to: '/research', key: 'nav.research', icon: <FlaskConical />, show: hasResearch },
    { to: '/roadmap', key: 'nav.roadmap', icon: <Sparkles /> },
  ],
  STUDENT: [
    { to: '/', key: 'nav.dashboard', icon: <LayoutDashboard /> },
    { to: '/timetable', key: 'nav.myTimetable', icon: <CalendarDays /> },
    { to: '/learn', key: 'nav.learn', icon: <MonitorPlay /> },
    { to: '/results', key: 'nav.results', icon: <Award /> },
    { to: '/wallet', key: 'nav.wallet', icon: <BadgeCheck /> },
    { to: '/fees', key: 'nav.fees', icon: <Wallet /> },
    { to: '/communication', key: 'nav.communication', icon: <MessagesSquare />, badge: true },
    { to: '/library', key: 'nav.library', icon: <Library /> },
    { to: '/research', key: 'nav.research', icon: <FlaskConical />, show: hasResearch },
    { to: '/me', key: 'nav.profile', icon: <UserCircle2 /> },
  ],
  GUARDIAN: [
    { to: '/', key: 'nav.children', icon: <LayoutDashboard /> },
    { to: '/learn', key: 'nav.learn', icon: <MonitorPlay /> },
    { to: '/results', key: 'nav.results', icon: <Award /> },
    { to: '/wallet', key: 'nav.wallet', icon: <BadgeCheck /> },
    { to: '/fees', key: 'nav.fees', icon: <Wallet /> },
    { to: '/communication', key: 'nav.communication', icon: <MessagesSquare />, badge: true },
    { to: '/library', key: 'nav.library', icon: <Library /> },
    { to: '/roadmap', key: 'nav.roadmap', icon: <Sparkles /> },
  ],
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const v = localStorage.getItem('unifiedtree-erp-theme')
      return v ? v === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('unifiedtree-erp-theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [dark])
  return [dark, setDark] as const
}

export function ThemeToggle() {
  const [dark, setDark] = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { user, tenant } = useMe()
  const { signOut } = useSession()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const items = NAV[user.role].filter((i) => !i.show || i.show(tenant))
  const counts = useNotificationCounts(user.role !== 'SUPER_ADMIN')
  const unread = (counts.data?.announcements ?? 0) + (counts.data?.messages ?? 0)

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-lg font-bold text-brand-foreground">
          {tenant ? tenant.shortName.slice(0, 2) : 'UT'}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{tenant?.name ?? 'UnifiedTree Platform'}</p>
          <p className="truncate text-xs text-muted-foreground">{tenant ? `${tenant.city} · ${tenant.framework.replace(/_/g, ' ')}` : t('app.tagline')}</p>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors [&_svg]:size-4',
                isActive ? 'bg-brand-soft text-brand' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            {it.icon}
            <span className="flex-1">{t(it.key)}</span>
            {it.badge && unread > 0 && <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">{unread}</span>}
          </NavLink>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.title}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.signOut')}
            title={t('common.signOut')}
            onClick={() => {
              signOut()
              navigate('/login')
            }}
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-border bg-card lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 start-0 w-72 bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute end-2 top-4" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></Button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/85 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></Button>
          <Badge variant="muted" className="hidden sm:inline-flex">{t(`roles.${user.role}`)}</Badge>
          {tenant && <Badge variant="outline" className="hidden md:inline-flex">{tenant.subdomain}.unifiedtree.app</Badge>}
          <div className="flex-1" />
          <LanguagePicker />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-24 sm:p-6 sm:pb-24">{children}</main>
        <AssistantLauncher />
      </div>
    </div>
  )
}
