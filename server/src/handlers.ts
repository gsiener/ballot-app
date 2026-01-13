import type { Context } from 'hono'
import { createSpan, addSpanAttributes, recordSpanEvent, setSpanStatus } from './telemetry'

type SpanType = ReturnType<typeof createSpan>

/**
 * Wraps an async handler with OpenTelemetry span lifecycle management.
 * Handles span creation, status setting, and cleanup automatically.
 */
export function withSpan<T>(
  spanName: string,
  handler: (span: SpanType) => Promise<T>
): Promise<T> {
  const span = createSpan(spanName)

  return handler(span)
    .then(result => {
      setSpanStatus(span, true)
      return result
    })
    .catch(error => {
      setSpanStatus(span, false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    })
    .finally(() => {
      span.end()
    })
}

/**
 * Configuration for a resource type (ballot, dashboard, etc.)
 */
export interface ResourceConfig<T extends { id: string; version?: number }> {
  name: string                                    // e.g., 'ballot', 'dashboard'
  getAll: (kv: KVNamespace) => Promise<T[]>      // Function to load all items
  saveAll: (kv: KVNamespace, items: T[]) => Promise<void>  // Function to save all items
}

/**
 * Creates a handler for GET /api/{resource} - list all items
 */
export function createListHandler<T extends { id: string; version?: number }>(
  config: ResourceConfig<T>,
  options?: {
    filter?: (item: T) => boolean
    sort?: (a: T, b: T) => number
    transform?: (items: T[]) => any[]
  }
) {
  return async (c: Context) => {
    return withSpan(`get_all_${config.name}s`, async (span) => {
      const items = await config.getAll(c.env.BALLOTS_KV)

      let result = options?.filter ? items.filter(options.filter) : items
      if (options?.sort) {
        result = result.sort(options.sort)
      }

      const output = options?.transform ? options.transform(result) : result

      addSpanAttributes({
        [`${config.name}.count`]: result.length,
        'operation': `get_all_${config.name}s`
      })

      recordSpanEvent(`${config.name}s_retrieved`, {
        [`${config.name}.count`]: result.length
      })

      return c.json(output)
    })
  }
}

/**
 * Creates a handler for GET /api/{resource}/:id - get single item
 */
export function createGetByIdHandler<T extends { id: string; version?: number }>(
  config: ResourceConfig<T>,
  options?: {
    includeAttributes?: (item: T) => Record<string, any>
  }
) {
  return async (c: Context) => {
    const id = c.req.param('id')

    return withSpan(`get_single_${config.name}`, async (span) => {
      addSpanAttributes({
        [`${config.name}.id`]: id,
        'operation': `get_single_${config.name}`
      })

      const items = await config.getAll(c.env.BALLOTS_KV)
      const item = items.find(i => i.id === id)

      if (!item) {
        addSpanAttributes({ [`${config.name}.found`]: false })
        recordSpanEvent(`${config.name}_not_found`, { [`${config.name}.id`]: id })
        setSpanStatus(span, false, `${config.name} not found`)
        return c.json({ error: `${capitalize(config.name)} not found` }, 404)
      }

      const extraAttrs = options?.includeAttributes?.(item) || {}
      addSpanAttributes({
        [`${config.name}.found`]: true,
        ...extraAttrs
      })

      recordSpanEvent(`${config.name}_retrieved`, {
        [`${config.name}.id`]: id,
        ...extraAttrs
      })

      return c.json(item)
    })
  }
}

/**
 * Creates a handler for DELETE /api/{resource}/:id - delete single item
 */
export function createDeleteHandler<T extends { id: string; version?: number }>(
  config: ResourceConfig<T>,
  options?: {
    buildResponse?: (deleted: T) => any
    eventName?: string
  }
) {
  return async (c: Context) => {
    const id = c.req.param('id')

    return withSpan(`delete_${config.name}`, async (span) => {
      addSpanAttributes({
        [`${config.name}.id`]: id,
        'operation': `delete_${config.name}`
      })

      const items = await config.getAll(c.env.BALLOTS_KV)
      const index = items.findIndex(i => i.id === id)

      if (index === -1) {
        addSpanAttributes({ [`${config.name}.found`]: false })
        recordSpanEvent('delete_failed', {
          [`${config.name}.id`]: id,
          'error': `${config.name}_not_found`
        })
        setSpanStatus(span, false, `${config.name} not found`)
        return c.json({ error: `${capitalize(config.name)} not found` }, 404)
      }

      const deleted = items[index]!
      items.splice(index, 1)
      await config.saveAll(c.env.BALLOTS_KV, items)

      addSpanAttributes({ [`${config.name}.found`]: true })
      recordSpanEvent(options?.eventName || `${config.name}_deleted`, {
        [`${config.name}.id`]: id
      })

      const response = options?.buildResponse?.(deleted) || {
        message: `${capitalize(config.name)} deleted successfully`,
        [`deleted${capitalize(config.name)}`]: { id: deleted.id }
      }

      return c.json(response)
    })
  }
}

/**
 * Creates a handler for POST /api/{resource} - create new item
 * Initializes version to 1 for new items
 */
export function createCreateHandler<T extends { id: string; version?: number }, TInput>(
  config: ResourceConfig<T>,
  options: {
    validate: (body: any) => { valid: boolean; error?: string }
    buildItem: (body: TInput, existingItems: T[]) => T
    includeAttributes?: (item: T) => Record<string, any>
  }
) {
  return async (c: Context) => {
    return withSpan(`create_${config.name}`, async (span) => {
      const body = await c.req.json()

      addSpanAttributes({ 'operation': `create_${config.name}` })

      const validation = options.validate(body)
      if (!validation.valid) {
        addSpanAttributes({
          'validation.failed': true,
          'error': validation.error
        })
        recordSpanEvent('validation_failed', { 'reason': validation.error })
        setSpanStatus(span, false, validation.error)
        return c.json({ error: validation.error }, 400)
      }

      const items = await config.getAll(c.env.BALLOTS_KV)
      const newItem = options.buildItem(body, items)
      // Initialize version to 1 for new items
      const newItemWithVersion = { ...newItem, version: 1 }

      items.push(newItemWithVersion)
      await config.saveAll(c.env.BALLOTS_KV, items)

      const extraAttrs = options.includeAttributes?.(newItemWithVersion) || {}
      addSpanAttributes({
        [`${config.name}.id`]: newItemWithVersion.id,
        [`${config.name}s.total_count`]: items.length,
        'version': 1,
        ...extraAttrs
      })

      recordSpanEvent(`${config.name}_created`, {
        [`${config.name}.id`]: newItemWithVersion.id,
        [`${config.name}s.total_count`]: items.length,
        'version': 1
      })

      return c.json(newItemWithVersion, 201)
    })
  }
}

/**
 * Creates a handler for PUT /api/{resource}/:id - update item
 * Supports optimistic locking via version field
 */
export function createUpdateHandler<T extends { id: string; version?: number }>(
  config: ResourceConfig<T>,
  options: {
    applyUpdates: (current: T, body: any) => T
    includeAttributes?: (updated: T, original: T) => Record<string, any>
    skipVersionCheck?: boolean  // For updates that don't need optimistic locking
  }
) {
  return async (c: Context) => {
    const id = c.req.param('id')

    return withSpan(`update_${config.name}`, async (span) => {
      const body = await c.req.json()

      addSpanAttributes({
        [`${config.name}.id`]: id,
        'operation': `update_${config.name}`
      })

      const items = await config.getAll(c.env.BALLOTS_KV)
      const index = items.findIndex(i => i.id === id)

      if (index === -1) {
        addSpanAttributes({ [`${config.name}.found`]: false })
        recordSpanEvent(`${config.name}_not_found`, { [`${config.name}.id`]: id })
        setSpanStatus(span, false, `${config.name} not found`)
        return c.json({ error: `${capitalize(config.name)} not found` }, 404)
      }

      const original = items[index]!
      const currentVersion = original.version ?? 1
      const incomingVersion = body.version ?? 1

      // Optimistic locking: check version matches (unless skipped)
      if (!options.skipVersionCheck && incomingVersion !== currentVersion) {
        addSpanAttributes({
          [`${config.name}.found`]: true,
          'version.conflict': true,
          'version.current': currentVersion,
          'version.incoming': incomingVersion
        })
        recordSpanEvent('version_conflict', {
          [`${config.name}.id`]: id,
          'version.current': currentVersion,
          'version.incoming': incomingVersion
        })
        setSpanStatus(span, false, `Version conflict - ${config.name} was modified by another request`)
        return c.json({
          error: `Version conflict - ${config.name} was modified by another request. Please refresh and try again.`,
          currentVersion
        }, 409)
      }

      const updated = options.applyUpdates(original, body)
      // Increment version on successful update
      const updatedWithVersion = { ...updated, version: currentVersion + 1 }
      items[index] = updatedWithVersion
      await config.saveAll(c.env.BALLOTS_KV, items)

      const extraAttrs = options.includeAttributes?.(updatedWithVersion, original) || {}
      addSpanAttributes({
        [`${config.name}.found`]: true,
        'version.new': currentVersion + 1,
        ...extraAttrs
      })

      recordSpanEvent(`${config.name}_updated`, {
        [`${config.name}.id`]: id,
        'version': currentVersion + 1,
        ...extraAttrs
      })

      return c.json(updatedWithVersion)
    })
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
