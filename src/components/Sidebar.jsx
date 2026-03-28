import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, BarChart2, Send, Inbox,
  BookOpen, CheckSquare, Settings, LogOut, Layers
} from 'lucide-react'
import { useArka } from '../context/ArkaContext'

const NAV = [
  { path: '/',               icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/content-pipeline', icon: Layers,        label: 'Content Pipeline' },
  { path: '/posts',          icon: FileText,         label: 'Post Logger' },
  { path: '/analytics',      icon: BarChart2,        label: 'Analytics' },
  { path: '/outbound',       icon: Send,             label: 'Outbound' },
  { path: '/inbound',        icon: Inbox,            label: 'Inbound' },
  { path: '/lead-magnets',   icon: BookOpen,         label: 'Lead Magnets' },
  { path: '/tasks',          icon: CheckSquare,      label: 'Tasks' },
]

export default function Sidebar() {
  const { user, settings, signOut } = useArka()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoArea}>
        <div style={styles.logoRow}>
          <svg width="18" height="13" viewBox="0 0 20 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M10 1 L19 13 L1 13 Z" fill="none" stroke="#F97316" strokeWidth="1.5"/>
          </svg>
          <span style={styles.wordmark}>ARKA</span>
        </div>
        <p style={styles.tagline}>Your brand. Fully operated.</p>
      </div>

      <div style={styles.divider} />

      {/* Nav */}
      <nav style={styles.nav}>
        {NAV.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {})
            })}
          >
            <Icon size={16} />
            <span style={styles.navLabel}>{label}</span>
            <div style={styles.activeBar} className="active-bar" />
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div style={styles.footer}>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            ...styles.navItem,
            ...(isActive ? styles.navItemActive : {})
          })}
        >
          <Settings size={16} />
          <span style={styles.navLabel}>Settings</span>
        </NavLink>

        <button style={styles.signOutBtn} onClick={handleSignOut}>
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>

        <p style={styles.footerTagline}>
          NOT ARCHAEOLOGY.<br />YOUR MONDAY SHOULD START WITH WORK.
        </p>
      </div>
    </aside>
  )
}

const styles = {
  sidebar: {
    width: 220,
    minWidth: 220,
    background: 'var(--arka-cream-dark)',
    borderRight: '1px solid var(--arka-gray-light)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden'
  },
  logoArea: {
    padding: '20px 16px 14px'
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    marginBottom: '3px'
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '22px',
    letterSpacing: '0.04em',
    color: 'var(--arka-black)'
  },
  tagline: {
    fontSize: '10px',
    color: 'var(--arka-gray)',
    fontFamily: 'var(--font-body)'
  },
  divider: {
    height: '1px',
    background: 'var(--arka-gray-light)',
    margin: '0 0 8px'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 8px'
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 10px',
    borderRadius: '8px',
    color: 'var(--arka-gray)',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background 0.12s, color 0.12s',
    position: 'relative',
    overflow: 'hidden'
  },
  navItemActive: {
    background: 'var(--arka-white)',
    color: 'var(--arka-black)',
    borderLeft: '3px solid var(--arka-orange)',
    paddingLeft: '7px'
  },
  navLabel: {
    flex: 1
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '3px',
    background: 'var(--arka-orange)'
  },
  footer: {
    padding: '8px 8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  signOutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 10px',
    borderRadius: '8px',
    background: 'transparent',
    color: 'var(--arka-gray)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.12s, color 0.12s'
  },
  footerTagline: {
    fontSize: '9px',
    color: 'var(--arka-gray)',
    opacity: 0.5,
    fontFamily: 'var(--font-display)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    lineHeight: 1.6,
    padding: '12px 10px 0',
    borderTop: '1px solid var(--arka-gray-light)',
    marginTop: 4
  }
}
