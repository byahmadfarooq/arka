import React from 'react'
import { isToday, isTomorrow, isThisWeek, isPast, parseISO } from 'date-fns'

export default function DueDateBadge({ date }) {
  if (!date) return null

  const d = typeof date === 'string' ? parseISO(date) : date

  let label, bg, color

  if (isPast(d) && !isToday(d)) {
    label = 'Overdue'; bg = '#FEE2E2'; color = 'var(--arka-red)'
  } else if (isToday(d)) {
    label = 'Due Today'; bg = 'var(--arka-orange-light)'; color = 'var(--arka-orange-dark)'
  } else if (isTomorrow(d)) {
    label = 'Tomorrow'; bg = '#FEF9C3'; color = '#B45309'
  } else if (isThisWeek(d)) {
    label = 'This Week'; bg = 'var(--arka-gray-light)'; color = 'var(--arka-gray)'
  } else {
    return null
  }

  return (
    <span style={{ ...styles.badge, background: bg, color }}>
      {label}
    </span>
  )
}

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 500
  }
}
