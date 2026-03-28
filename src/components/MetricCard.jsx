import React from 'react'

export default function MetricCard({ label, value, subLabel, icon: Icon, color = 'orange' }) {
  const colorClass = `metric-value-${color}`

  return (
    <div className="card" style={styles.card}>
      <div style={styles.top}>
        <span className="display-label">{label}</span>
        {Icon && (
          <div style={{ ...styles.iconWrap, background: `var(--arka-${color === 'orange' ? 'orange-light' : color === 'blue' ? '#DBEAFE' : color === 'green' ? '#DCFCE7' : '#EDE9FE'})` }}>
            <Icon size={18} color={`var(--arka-${color})`} />
          </div>
        )}
      </div>
      <div className={`metric-value ${colorClass}`} style={styles.value}>
        {value ?? '—'}
      </div>
      {subLabel && (
        <div style={styles.subLabel}>{subLabel}</div>
      )}
    </div>
  )
}

const styles = {
  card: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  top: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--arka-orange-light)'
  },
  value: {
    marginTop: 4
  },
  subLabel: {
    fontSize: 12,
    color: 'var(--arka-gray)'
  }
}
