import { describe, test, expect } from 'bun:test'
import { kvCollection } from './kv'

type Item = { id: string; version?: number }

// In-memory KV adapter — the second adapter that justifies the seam. Prod uses
// Cloudflare KV; tests use this map, exercising kvCollection through the exact
// same interface.
function fakeKV(initial: Record<string, string> = {}, opts: { failPut?: boolean } = {}) {
  const store = new Map(Object.entries(initial))
  const kv = {
    get: async (key: string) => (store.has(key) ? store.get(key)! : null),
    put: async (key: string, value: string) => {
      if (opts.failPut) throw new Error('KV put failed')
      store.set(key, value)
    }
  } as unknown as KVNamespace
  return { kv, store }
}

describe('kvCollection.getAll', () => {
  test('parses and returns stored items', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }]
    const { kv } = fakeKV({ things: JSON.stringify(items) })
    const store = kvCollection<Item>('things')
    expect(await store.getAll(kv)).toEqual(items)
  })

  test('returns the fallback when the key is empty', async () => {
    const { kv } = fakeKV()
    const store = kvCollection<Item>('things')
    expect(await store.getAll(kv)).toEqual([])
  })

  test('seeds the key when empty and seedOnEmpty is set', async () => {
    const seed: Item[] = [{ id: 'demo' }]
    const { kv, store: raw } = fakeKV()
    const store = kvCollection<Item>('things', { fallback: () => seed, seedOnEmpty: true })

    expect(await store.getAll(kv)).toEqual(seed)
    // The seed was persisted, not just returned.
    expect(raw.get('things')).toBe(JSON.stringify(seed))
  })

  test('does not seed when seedOnEmpty is not set', async () => {
    const { kv, store: raw } = fakeKV()
    const store = kvCollection<Item>('things', { fallback: () => [{ id: 'demo' }] })
    await store.getAll(kv)
    expect(raw.has('things')).toBe(false)
  })

  test('returns the fallback when the stored JSON is corrupt', async () => {
    const { kv } = fakeKV({ things: '{ not valid json' })
    const store = kvCollection<Item>('things', { fallback: () => [{ id: 'safe' }] })
    expect(await store.getAll(kv)).toEqual([{ id: 'safe' }])
  })
})

describe('kvCollection.saveAll', () => {
  test('round-trips through getAll', async () => {
    const { kv } = fakeKV()
    const store = kvCollection<Item>('things')
    const items: Item[] = [{ id: 'x', version: 2 }]
    await store.saveAll(kv, items)
    expect(await store.getAll(kv)).toEqual(items)
  })

  test('throws when the underlying put fails', async () => {
    const { kv } = fakeKV({}, { failPut: true })
    const store = kvCollection<Item>('things')
    await expect(store.saveAll(kv, [{ id: 'x' }])).rejects.toThrow('KV put failed')
  })
})
