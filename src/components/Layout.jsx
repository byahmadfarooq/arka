import React from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useArka } from '../context/ArkaContext'
import Sidebar from './Sidebar'

export default function Layout() {
  const { session, loadingAuth } = useArka()

  if (loadingAuth) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingInner}>
          <svg width="24" height="17" viewBox="0 0 20 14" fill="none">
            <path d="M10 1 L19 13 L1 13 Z" fill="none" stroke="#F97316" strokeWidth="1.5"/>
          </svg>
          <span style={styles.loadingText}>ARKA</span>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  loading: {
    height: '100vh',
    background: 'var(--arka-cream)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    opacity: 0.4
  },
  loadingText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '22px',
    letterSpacing: '0.04em',
    color: 'var(--arka-black)'
  }
}
