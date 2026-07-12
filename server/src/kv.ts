/**
 * KV-backed collections.
 *
 * Every resource is stored as a single JSON array under one KV key. The
 * read/parse/fallback and serialize/save logic is identical for ballots,
 * dashboards, and attendances — this module owns it once. The KVNamespace is
 * the port; an in-memory map is the test adapter (see kv.test.ts).
 */

export interface KvCollection<T> {
  getAll(kv: KVNamespace): Promise<T[]>
  saveAll(kv: KVNamespace, items: T[]): Promise<void>
}

interface KvCollectionOptions<T> {
  /** Value returned when the key is empty, unreadable, or corrupt. Defaults to []. */
  fallback?: () => T[]
  /** When the key is empty, persist the fallback before returning it. */
  seedOnEmpty?: boolean
}

export function kvCollection<T>(key: string, options: KvCollectionOptions<T> = {}): KvCollection<T> {
  const fallback = options.fallback ?? (() => [])

  return {
    async getAll(kv: KVNamespace): Promise<T[]> {
      try {
        const json = await kv.get(key)
        if (json !== null) {
          return JSON.parse(json) as T[]
        }
        if (options.seedOnEmpty) {
          const seed = fallback()
          await kv.put(key, JSON.stringify(seed))
          return seed
        }
        return fallback()
      } catch (error) {
        console.error(`Error reading "${key}" from KV:`, error)
        return fallback()
      }
    },

    async saveAll(kv: KVNamespace, items: T[]): Promise<void> {
      try {
        await kv.put(key, JSON.stringify(items))
      } catch (error) {
        console.error(`Error saving "${key}" to KV:`, error)
        throw error
      }
    }
  }
}
