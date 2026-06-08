import type { OHLCVResponse, HealthInfo } from '../types'

export async function fetchHealth(): Promise<HealthInfo> {
  const start = Date.now()
  try {
    const res = await fetch('/health')
    const latencyMs = Date.now() - start
    if (!res.ok) return { status: 'error', latencyMs }
    const data = await res.json()
    return { status: data.status === 'ok' ? 'ok' : 'error', latencyMs }
  } catch {
    return { status: 'error', latencyMs: null }
  }
}

export async function fetchStock(ticker: string, days: number): Promise<OHLCVResponse> {
  const res = await fetch(`/stocks/${ticker}?days=${days}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail ?? `Failed to load ${ticker}`)
  }
  return res.json()
}
