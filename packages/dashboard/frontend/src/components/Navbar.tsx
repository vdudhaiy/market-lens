import clsx from 'clsx'
import { TrendingUp, LayoutDashboard, Activity } from 'lucide-react'
import type { HealthStatus, View } from '../types'

interface Props {
  view: View
  onViewChange: (v: View) => void
  healthStatus: HealthStatus
}

export function Navbar({ view, onViewChange, healthStatus }: Props) {
  return (
    <header className="flex items-center h-14 px-6 border-b border-zinc-800 bg-zinc-950 shrink-0 gap-8">
      <div className="flex items-center gap-2.5">
        <TrendingUp size={18} className="text-indigo-400" />
        <span className="text-white font-semibold tracking-tight">Market Lens</span>
      </div>

      <nav className="flex items-center gap-1">
        <button
          onClick={() => onViewChange('dashboard')}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            view === 'dashboard'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900',
          )}
        >
          <LayoutDashboard size={14} />
          Dashboard
        </button>

        <button
          onClick={() => onViewChange('health')}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            view === 'health'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900',
          )}
        >
          <Activity size={14} />
          Health
          <span
            className={clsx('w-1.5 h-1.5 rounded-full', {
              'bg-emerald-500': healthStatus === 'ok',
              'bg-red-500': healthStatus === 'error',
              'bg-yellow-400 animate-pulse': healthStatus === 'loading',
            })}
          />
        </button>
      </nav>
    </header>
  )
}
