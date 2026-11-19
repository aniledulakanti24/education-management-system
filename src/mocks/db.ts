import { createSeed, DB_VERSION, type Db } from './seed'

const KEY = 'unifiedtree-erp-db'
let cache: Db | null = null

export function getDb(): Db {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed.version === DB_VERSION) {
        cache = parsed
        return cache
      }
    }
  } catch {
    /* storage unavailable or corrupt: fall back to a fresh seed */
  }
  cache = createSeed()
  persist()
  return cache
}

export function persist() {
  if (!cache) return
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* quota exceeded or private mode: keep working in memory */
  }
}

export function resetDb() {
  cache = createSeed()
  persist()
  return cache
}
