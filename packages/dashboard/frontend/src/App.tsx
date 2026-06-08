import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Navbar } from './components/Navbar'
import { HealthDashboard } from './components/HealthDashboard'
import { TickerSidebar } from './components/TickerSidebar'
import { PriceChart } from './components/PriceChart'
import { VolumeChart } from './components/VolumeChart'
import { OHLCVStats } from './components/OHLCVStats'
import { fetchHealth, fetchStock } from './api'
import type { OHLCV, HealthInfo, LatencyRecord, View } from './types'

const DAYS_OPTIONS = [
  { label: '7D', value: 7 },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '180D', value: 180 },
  { label: '1Yr', value: 365 },
  { label: '2Yr', value: 730 },
  { label: '3Yr', value: 1095 },
]

const MAX_HISTORY = 50

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [ticker, setTicker] = useState('NVDA')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<OHLCV[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthInfo>({ status: 'loading', latencyMs: null })
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [latencyHistory, setLatencyHistory] = useState<LatencyRecord[]>([])

  useEffect(() => {
    const check = () =>
      fetchHealth().then(info => {
        const now = new Date()
        setHealth(info)
        setLastChecked(now)
        setLatencyHistory(prev => {
          const record: LatencyRecord = {
            time: now.toLocaleTimeString(),
            latencyMs: info.latencyMs,
            status: info.status,
          }
          const next = [...prev, record]
          return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
        })
      })
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  const loadStock = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchStock(ticker, days)
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [ticker, days])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  const latest = data[data.length - 1]
  const prev = data[data.length - 2]
  const change = latest && prev ? latest.close - prev.close : null
  const changePct = change !== null && prev ? (change / prev.close) * 100 : null
  const isPositive = change !== null ? change >= 0 : null

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Navbar view={view} onViewChange={setView} healthStatus={health.status} />

      {view === 'health' ? (
        <HealthDashboard
          status={health.status}
          latencyMs={health.latencyMs}
          lastChecked={lastChecked}
          history={latencyHistory}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <TickerSidebar selected={ticker} onSelect={setTicker} />

          <main className="flex-1 flex flex-col overflow-hidden p-6 gap-5 min-w-0">
            {/* Ticker header row */}
            <div className="flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-baseline gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{ticker}</h1>
                  {latest && (
                    <span className="font-mono text-xl font-semibold text-zinc-100">
                      ${latest.close.toFixed(2)}
                    </span>
                  )}
                  {change !== null && (
                    <span
                      className={clsx(
                        'flex items-center gap-1 text-sm font-mono',
                        isPositive ? 'text-emerald-400' : 'text-red-400',
                      )}
                    >
                      {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {isPositive ? '+' : ''}
                      {change.toFixed(2)} ({isPositive ? '+' : ''}
                      {changePct!.toFixed(2)}%)
                    </span>
                  )}
                </div>
                {latest && (
                  <p className="text-zinc-500 text-xs mt-1">Last updated {latest.date}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex rounded-lg overflow-hidden border border-zinc-800">
                  {DAYS_OPTIONS.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => setDays(value)}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-medium transition-colors',
                        days === value
                          ? 'bg-indigo-600 text-white'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={loadStock}
                  disabled={loading}
                  title="Refresh"
                  className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* OHLCV stats */}
            {latest && (
              <div className="shrink-0">
                <OHLCVStats
                  open={latest.open}
                  high={latest.high}
                  low={latest.low}
                  close={latest.close}
                  volume={latest.volume}
                  prevClose={prev?.close}
                />
              </div>
            )}

            {/* Chart area */}
            {error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-zinc-500 text-sm">{error}</p>
                  <button
                    onClick={loadStock}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : loading && data.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <RefreshCw size={13} className="animate-spin" />
                  Loading {ticker}...
                </div>
              </div>
            ) : data.length > 0 ? (
              <div className="flex-1 flex flex-col gap-4 min-h-0">
                <div className="flex-[7] min-h-0 bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                  <p className="text-[10px] text-zinc-500 tracking-widest font-medium mb-3">
                    CLOSE PRICE
                  </p>
                  <div className="h-[calc(100%-28px)]">
                    <PriceChart data={data} />
                  </div>
                </div>
                <div className="flex-[3] min-h-0 bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                  <p className="text-[10px] text-zinc-500 tracking-widest font-medium mb-3">
                    VOLUME
                  </p>
                  <div className="h-[calc(100%-28px)]">
                    <VolumeChart data={data} />
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      )}
    </div>
  )
}
