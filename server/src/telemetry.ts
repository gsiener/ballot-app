import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

let isInitialized = false

// Initialize OpenTelemetry for Cloudflare Workers
export function initTelemetry(env?: any) {
  if (isInitialized) return

  const honeycombApiKey = env?.HONEYCOMB_API_KEY || ''
  const honeycombDataset = env?.HONEYCOMB_DATASET || 'ballot-app'
  
  if (!honeycombApiKey) {
    console.log('HONEYCOMB_API_KEY not provided, skipping telemetry initialization')
    return
  }

  try {
    // Create resource
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'ballot-app-server',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env?.NODE_ENV || 'production',
    })

    // Create OTLP exporter for Honeycomb
    const exporter = new OTLPTraceExporter({
      url: 'https://api.honeycomb.io/v1/traces',
      headers: {
        'x-honeycomb-team': honeycombApiKey,
        'x-honeycomb-dataset': honeycombDataset,
      },
    })

    // Create tracer provider
    const provider = new BasicTracerProvider({
      resource,
    })

    // Register the exporter
    provider.addSpanProcessor(new BatchSpanProcessor(exporter))

    // Register the provider
    provider.register()

    isInitialized = true
    console.log('OpenTelemetry initialized successfully for Honeycomb')
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error)
  }
}

// Create a custom span
export function createSpan(name: string, attributes?: Record<string, any>) {
  const tracer = trace.getTracer('ballot-app-server')
  const span = tracer.startSpan(name, {
    kind: SpanKind.SERVER,
    attributes: {
      'service.name': 'ballot-app-server',
      ...attributes,
    },
  })
  
  return span
}

// Add attributes to current active span
export function addSpanAttributes(attributes: Record<string, any>) {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan) {
    activeSpan.setAttributes(attributes)
  }
}

// Record an event on the current span
export function recordSpanEvent(name: string, attributes?: Record<string, any>) {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan) {
    activeSpan.addEvent(name, attributes)
  }
}

// Helper to set span status
export function setSpanStatus(span: any, success: boolean, message?: string) {
  if (success) {
    span.setStatus({ code: SpanStatusCode.OK })
  } else {
    span.setStatus({ 
      code: SpanStatusCode.ERROR, 
      message: message || 'Operation failed' 
    })
  }
}