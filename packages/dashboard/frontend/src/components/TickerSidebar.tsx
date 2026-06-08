import { useState } from 'react'
import clsx from 'clsx'
import { Search } from 'lucide-react'

const TICKERS = [
  'AMD', 'APLD', 'AAOI', 'ACHR', 'ALAB', 'BMNR', 'BN', 'COHR', 'CRDO',
  'CRM', 'GOOGL', 'HIMS', 'HOOD', 'IONQ', 'JOBY', 'MNTS', 'MRVL', 'MSFT',
  'MU', 'NVDA', 'OKLO', 'ORCL', 'OSCR', 'PATH', 'PLTR', 'QCOM', 'QLYS',
  'RDW', 'RGTI', 'SAP', 'SMCI', 'SOFI', 'SOUN', 'TEM', 'TSLA', 'VRT',
]

interface Props {
  selected: string
  onSelect: (ticker: string) => void
}

export function TickerSidebar({ selected, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const filtered = TICKERS.filter(t => t.startsWith(search.toUpperCase()))

  return (
    <aside className="w-48 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-zinc-900 text-zinc-200 text-xs rounded pl-7 pr-3 py-2 outline-none border border-zinc-800 focus:border-indigo-500 transition-colors placeholder-zinc-600 font-mono"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-4">No results</p>
        ) : (
          filtered.map(ticker => (
            <button
              key={ticker}
              onClick={() => onSelect(ticker)}
              className={clsx(
                'w-full flex items-center px-4 py-2.5 text-left transition-colors',
                selected === ticker
                  ? 'bg-indigo-500/10 text-indigo-300 border-r-2 border-indigo-500'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
              )}
            >
              <span className="font-mono text-sm font-medium">{ticker}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
