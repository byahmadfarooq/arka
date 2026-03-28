import React from 'react'

export default function ProgressBar({ label, current = 0, target = 1, unit = '', color = 'orange' }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const fill = pct >= 100 ? 'var(--arka-green)' : 'var(--arka-orange)'

  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-meta">
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--arka-black)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--arka-gray)' }}>
          {unit === '$' ? `$${current.toLocaleString()} / $${target.toLocaleString()}` : `${current} / ${target}${unit ? ' ' + unit : ''}`}
        </span>
      </div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
      <div className="progress-bar-pct">{pct.toFixed(1)}% Complete</div>
    </div>
  )
}
