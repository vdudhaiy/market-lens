import { useState, useEffect, useCallback, useRef } from 'react'
import clsx from 'clsx'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Navbar } from './components/Navbar'
import { HomePage } from './components/HomePage'
import { HealthDashboard } from './components/HealthDashboard'
import { TickerSidebar } from './components/TickerSidebar'
import { ComparisonView } from './components/ComparisonView'
import { PriceChart } from './components/PriceChart'
import { VolumeChart, volUnit } from './components/VolumeChart'
import { OHLCVStats } from './components/OHLCVStats'
import { StockInfoCard } from './components/StockInfoCard'
import { AnalystPanel } from './components/AnalystPanel'
import { fetchCurrentStock, fetchHealth, fetchMarketStatus, fetchStock, fetchStockDetails } from './api'
import type { OHLCV, HealthInfo, LatencyRecord, View, StockDetails, ComparisonGroup } from './types'

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
  const [view, setView] = useState<View>('home')
  const [ticker, setTicker] = useState('NVDA')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<OHLCV[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<StockDetails | null>(null)
  const [comparisonGroup, setComparisonGroup] = useState<ComparisonGroup | null>(null)
  const [health, setHealth] = useState<HealthInfo>({ status: 'loading', latencyMs: null })
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [latencyHistory, setLatencyHistory] = useState<LatencyRecord[]>([])
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null)
  const [currentData, setCurrentData] = useState<OHLCV | null>(null)
  const [currentFetchedAt, setCurrentFetchedAt] = useState<Date | null>(null)
  const [currentLoading, setCurrentLoading] = useState(false)

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

  useEffect(() => {
    const check = () => fetchMarketStatus().then(setMarketOpen)
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  const loadCurrent = useCallback(() => {
    setCurrentLoading(true)
    return fetchCurrentStock(ticker)
      .then(res => {
        setCurrentData(res.data[0] ?? null)
        setCurrentFetchedAt(new Date())
      })
      .catch(() => {})
      .finally(() => setCurrentLoading(false))
  }, [ticker])

  useEffect(() => {
    setCurrentData(null)
    setCurrentFetchedAt(null)

    loadCurrent()

    if (!marketOpen) return
    const id = setInterval(loadCurrent, 2 * 60_000)
    return () => clearInterval(id)
  }, [ticker, marketOpen, loadCurrent])

  // Pre-market: date string contains 'T' (e.g. "2026-06-09T07:30") vs plain "2026-06-09"
  const isPreMarket = !marketOpen && (currentData?.date?.includes('T') ?? false)

  useEffect(() => {
    if (!isPreMarket) return
    const id = setInterval(loadCurrent, 2 * 60_000)
    return () => clearInterval(id)
  }, [isPreMarket, loadCurrent])

  // Tracks which ticker was last loaded so we know whether to fetch details too
  const prevTicker = useRef<string>('')
  // Incremented on every load; stale responses from aborted loads are ignored
  const loadGen = useRef(0)

  const load = useCallback(async () => {
    const gen = ++loadGen.current
    const isNewTicker = prevTicker.current !== ticker
    prevTicker.current = ticker

    setError(null)
    setLoading(true)

    if (isNewTicker) {
      // Clear both so nothing renders until both arrive
      setData([])
      setDetails(null)
    }

    try {
      if (isNewTicker) {
        const [ohlcvRes, detailsRes] = await Promise.all([
          fetchStock(ticker, days),
          fetchStockDetails(ticker).catch(() => null),
        ])
        if (gen !== loadGen.current) return
        setData(ohlcvRes.data)
        setDetails(detailsRes)
      } else {
        // Only days changed — details are still valid
        const ohlcvRes = await fetchStock(ticker, days)
        if (gen !== loadGen.current) return
        setData(ohlcvRes.data)
      }
    } catch (e) {
      if (gen !== loadGen.current) return
      setError(e instanceof Error ? e.message : 'Failed to load data')
      if (isNewTicker) setData([])
    } finally {
      if (gen === loadGen.current) setLoading(false)
    }
  }, [ticker, days])

  useEffect(() => {
    load()
  }, [load])

  const today = new Date().toISOString().slice(0, 10)
  // Strip today's entry unless market is confirmed closed — partial candles skew the chart
  const displayData = marketOpen !== false ? data.filter(d => d.date !== today) : data

  const latest = displayData[displayData.length - 1]
  const prev = displayData[displayData.length - 2]

  // When market is open, currentData has today's live price and latest has yesterday in the archive.
  // When market is closed, currentData and latest share the same date so we step back one more.
  const prevClose = (() => {
    if (!currentData || !latest) return prev?.close ?? null
    return currentData.date === latest.date ? prev?.close ?? null : latest.close
  })()

  const displayPrice = currentData?.close ?? latest?.close ?? null
  const change = displayPrice != null && prevClose != null ? displayPrice - prevClose : null
  const changePct = change != null && prevClose != null ? (change / prevClose) * 100 : null
  const isPositive = change != null ? change >= 0 : null

  const displayName = details?.info?.displayName as string | undefined
  const shortName = details?.info?.shortName as string | undefined
  const primaryName = displayName ?? shortName

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Navbar view={view} onViewChange={setView} healthStatus={health.status} marketOpen={marketOpen} />

      {view === 'home' ? (
        <HomePage onNavigate={setView} />
      ) : view === 'health' ? (
        <HealthDashboard
          status={health.status}
          latencyMs={health.latencyMs}
          lastChecked={lastChecked}
          history={latencyHistory}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <TickerSidebar
            selected={ticker}
            onSelect={t => { setComparisonGroup(null); setTicker(t) }}
            onCompare={setComparisonGroup}
          />

          {comparisonGroup ? (
            <ComparisonView group={comparisonGroup} onBack={() => setComparisonGroup(null)} marketOpen={marketOpen} />
          ) : (
          <main className="flex-1 overflow-y-auto p-6 min-w-0">
            <div className="flex flex-col gap-5 max-w-6xl">
              {/* Ticker header row */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold tracking-tight">
                      {primaryName ?? ticker}
                      {primaryName && (
                        <span className="text-zinc-500 font-normal text-lg ml-2">({ticker})</span>
                      )}
                    </h1>
                    {displayPrice != null && (
                      <span className="font-mono text-xl font-semibold text-zinc-100">
                        ${displayPrice.toFixed(2)}
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
                  {(currentData ?? latest) && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className="text-zinc-500 text-xs">
                        {(marketOpen || isPreMarket) && currentFetchedAt
                          ? `Last updated at ${currentFetchedAt.toLocaleTimeString()}`
                          : `Last updated ${(currentData ?? latest!).date}`}
                      </p>
                      {isPreMarket && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 leading-none">
                          Pre-market
                        </span>
                      )}
                      <button
                        onClick={loadCurrent}
                        disabled={currentLoading}
                        title="Refresh current price"
                        className="text-zinc-600 hover:text-zinc-400 disabled:opacity-40 transition-colors"
                      >
                        <RefreshCw size={10} className={currentLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
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
                    onClick={load}
                    disabled={loading}
                    title="Refresh"
                    className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition-colors"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Company info (sector / industry / summary) */}
              {details?.info && <StockInfoCard info={details.info} />}

              {/* OHLCV stats */}
              {(currentData ?? latest) && (
                <OHLCVStats
                  open={(currentData ?? latest!).open}
                  high={(currentData ?? latest!).high}
                  low={(currentData ?? latest!).low}
                  close={(currentData ?? latest!).close}
                  volume={(currentData ?? latest!).volume}
                  prevClose={prevClose ?? undefined}
                />
              )}

              {/* Charts */}
              {error ? (
                <div className="flex items-center justify-center h-64 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="text-center space-y-2">
                    <p className="text-zinc-500 text-sm">{error}</p>
                    <button
                      onClick={load}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : loading && data.length === 0 ? (
                <div className="flex items-center justify-center h-64 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="flex items-center gap-2 text-zinc-500 text-sm">
                    <RefreshCw size={13} className="animate-spin" />
                    Loading {ticker}...
                  </div>
                </div>
              ) : displayData.length > 0 ? (
                <>
                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                    <p className="text-[10px] text-zinc-500 tracking-widest font-medium mb-3">
                      CLOSE PRICE
                    </p>
                    <div className="h-64">
                      <PriceChart data={displayData} />
                    </div>
                  </div>

                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                    <p className="text-[10px] text-zinc-500 tracking-widest font-medium mb-3">
                      VOLUME ({volUnit(displayData)})
                    </p>
                    <div className="h-36">
                      <VolumeChart data={displayData} />
                    </div>
                  </div>

                  {/* Analyst section — only rendered once details arrive */}
                  {details && (
                    <AnalystPanel
                      targets={details.analyst_price_targets}
                      recommendations={details.recommendations_summary}
                      earningsEstimates={details.earnings_estimate}
                      revenueEstimates={details.revenue_estimate}
                      currentPrice={latest?.close}
                    />
                  )}
                </>
              ) : null}
            </div>
          </main>
          )}
        </div>
      )}
    </div>
  )
}
