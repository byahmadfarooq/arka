import React from 'react'

const ICON_BG    = { orange: '#FEE8D6', blue: '#DBEAFE', green: '#DCFCE7', purple: '#EDE9FE', gray: '#F0ECE6' }
const ICON_COLOR = { orange: '#F97316', blue: '#2563EB', green: '#16A34A', purple: '#7C3AED', gray: '#6B6B6B' }

export default function MetricCard({ label, value, subLabel, icon: Icon, color = 'orange' }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="display-label">{label}</span>
        {Icon && (
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: ICON_BG[color] || ICON_BG.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={17} color={ICON_COLOR[color] || ICON_COLOR.orange} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className={`metric-value metric-value-${color}`}>{value ?? '—'}</div>
      {subLabel && <div style={{ fontSize: 12, color: '#999', marginTop: 5 }}>{subLabel}</div>}
    </div>
  )
}
