import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { OHLCV } from '../types'

function fmtVol(v: number) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M'
  return (v / 1e3).toFixed(0) + 'K'
}

interface Props {
  data: OHLCV[]
}

export function VolumeChart({ data }: Props) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          tickFormatter={v => v.slice(5)}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          tickLine={false}
          axisLine={false}
          width={58}
          tickFormatter={fmtVol}
        />
        <Tooltip
          formatter={(v: number) => [fmtVol(v), 'Volume']}
          contentStyle={{
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
          }}
          labelStyle={{ color: '#a1a1aa' }}
          itemStyle={{ color: '#818cf8' }}
        />
        <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.close >= d.open ? '#10b98128' : '#ef444428'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
