import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const initials = (name: string) =>
  name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1

export function ageFrom(dob: string) {
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

/** Absolute URL of an in-app route, honouring the deploy base path (e.g. GitHub Pages sub-folder). */
export const appUrl = (path: string) => `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`

/** The same URL without the scheme, for display. */
export const appHostPath = (path: string) => appUrl(path).replace(/^https?:\/\//, '')

/** Router basename derived from the deploy base path. */
export const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'
