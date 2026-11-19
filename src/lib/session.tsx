import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, getSessionUserId, setSessionUserId } from './api'
import type { Period, Tenant, User } from '@/types'

interface Me {
  user: User
  tenant: Tenant | null
  periods: Period[]
}

interface SessionValue {
  me: Me | null
  loading: boolean
  signIn: (userId: string) => Promise<void>
  signOut: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [uid, setUid] = useState<string | null>(() => getSessionUserId())
  const hasSession = !!uid
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me', uid],
    queryFn: () => api.get<Me>('/me'),
    enabled: hasSession,
    retry: false,
  })

  // A stale session (e.g. demo data was reset) drops back to the login screen.
  useEffect(() => {
    if (isError) {
      setSessionUserId(null)
      setUid(null)
    }
  }, [isError])

  // Apply tenant branding.
  useEffect(() => {
    const color = data?.tenant?.brandColor ?? '#0d9488'
    document.documentElement.style.setProperty('--brand', color)
    document.title = data?.tenant ? `${data.tenant.name} · UnifiedTree` : 'UnifiedTree Education ERP'
  }, [data?.tenant])

  const value: SessionValue = {
    me: hasSession ? data ?? null : null,
    loading: hasSession && isLoading,
    signIn: async (userId) => {
      setSessionUserId(userId)
      qc.clear()
      await qc.fetchQuery({ queryKey: ['me', userId], queryFn: () => api.get<Me>('/me') })
      setUid(userId)
    },
    signOut: () => {
      setSessionUserId(null)
      setUid(null)
      qc.clear()
      document.documentElement.style.removeProperty('--brand')
    },
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}

/** The signed-in user; only call inside authenticated routes. */
export function useMe() {
  const { me } = useSession()
  if (!me) throw new Error('Not signed in')
  return me
}

/** Locale tag combining the UI language with the institution's country, e.g. hi-IN or ar-AE. */
export function useLocaleTag() {
  const { i18n } = useTranslation()
  const { me } = useSession()
  const lang = i18n.language || 'en'
  const country = me?.tenant?.country
  if (!country) return lang
  try {
    return new Intl.Locale(`${lang}-${country}`).toString()
  } catch {
    return lang
  }
}

export function useFormat() {
  const tag = useLocaleTag()
  const { me } = useSession()
  const currency = me?.tenant?.currency ?? 'USD'
  return {
    tag,
    date: (iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
      new Intl.DateTimeFormat(tag, opts).format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)),
    number: (n: number) => new Intl.NumberFormat(tag).format(n),
    pct: (n: number | null | undefined) => (n === null || n === undefined ? '—' : new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(n) + '%'),
    money: (n: number) => new Intl.NumberFormat(tag, { style: 'currency', currency, ...(Number.isInteger(n) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}) }).format(n),
    weekday: (isoDay: number, style: 'short' | 'long' = 'short') =>
      new Intl.DateTimeFormat(tag, { weekday: style }).format(new Date(2024, 0, isoDay)), // 2024-01-01 was a Monday
  }
}
