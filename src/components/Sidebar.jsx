import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, BarChart2, Send, Inbox,
  BookOpen, CheckSquare, Settings, LogOut, Layers
} from 'lucide-react'
import { useArka } from '../context/ArkaContext'

const NAV = [
  { path: '/',                 icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/tasks',            icon: CheckSquare,     label: 'Tasks' },
  { path: '/content-pipeline', icon: Layers,          label: 'Content Pipeline' },
  { path: '/posts',            icon: FileText,        label: 'Post Logger' },
  { path: '/outbound',         icon: Send,            label: 'Outbound' },
  { path: '/inbound',          icon: Inbox,           label: 'Inbound' },
  { path: '/lead-magnets',     icon: BookOpen,        label: 'Lead Magnets' },
  { path: '/analytics',        icon: BarChart2,       label: 'Analytics' },
]

export default function Sidebar() {
  const { signOut } = useArka()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside style={s.sidebar}>
      {/* Logo */}
      <div style={s.logoArea}>
        <div style={s.logoRow}>
          <svg width="16" height="12" viewBox="0 0 20 14" fill="none">
            <path d="M10 1 L19 13 L1 13 Z" fill="none" stroke="#F97316" strokeWidth="2"/>
          </svg>
          <span style={s.wordmark}>ARKA</span>
        </div>
        <p style={s.tagline}>Your brand. Fully operated.</p>
      </div>

      <div style={s.divider} />

      {/* Nav */}
      <nav style={s.nav}>
        {NAV.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <div style={isActive ? s.itemActive : s.item}>
                {/* Orange indicator — absolutely positioned, never overlaps icon */}
                {isActive && <div style={s.indicator} />}
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  color={isActive ? '#1A1A1A' : '#777'}
                />
                <span style={{ ...s.label, color: isActive ? '#1A1A1A' : '#777', fontWeight: isActive ? 600 : 500 }}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Settings + Sign out */}
      <div style={s.footer}>
        <div style={s.divider} />
        <NavLink to="/settings" style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <div style={isActive ? s.itemActive : s.item}>
              {isActive && <div style={s.indicator} />}
              <Settings size={15} strokeWidth={isActive ? 2.2 : 1.8} color={isActive ? '#1A1A1A' : '#777'} />
              <span style={{ ...s.label, color: isActive ? '#1A1A1A' : '#777', fontWeight: isActive ? 600 : 500 }}>Settings</span>
            </div>
          )}
        </NavLink>

        <button style={s.signOutBtn} onClick={handleSignOut}>
          <LogOut size={14} color="#999" />
          <span>Sign Out</span>
        </button>

        <p style={s.footerTagline}>
          NOT ARCHAEOLOGY.<br />YOUR MONDAY SHOULD START WITH WORK.
        </p>
      </div>
    </aside>
  )
}

const s = {
  sidebar: {
    width: 220,
    minWidth: 220,
    background: '#EAE6DE',
    borderRight: '1px solid #D5D0C8',
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
    gap: '8px',
    marginBottom: '2px'
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '22px',
    letterSpacing: '0.06em',
    color: '#1A1A1A'
  },
  tagline: {
    fontSize: '10px',
    color: '#999',
    fontFamily: 'var(--font-body)'
  },
  divider: {
    height: '1px',
    background: '#D5D0C8',
    margin: '0'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    padding: '8px 8px 0'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '8px 10px 8px 13px',
    borderRadius: '7px',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.1s'
  },
  itemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '8px 10px 8px 13px',
    borderRadius: '7px',
    background: '#FFFFFF',
    cursor: 'pointer',
    position: 'relative',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: '6px',
    bottom: '6px',
    width: '3px',
    background: '#F97316',
    borderRadius: '0 3px 3px 0'
  },
  label: {
    flex: 1,
    fontSize: '13px'
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    padding: '0 8px 16px'
  },
  signOutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '8px 10px 8px 13px',
    borderRadius: '7px',
    background: 'transparent',
    color: '#999',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'left'
  },
  footerTagline: {
    fontSize: '9px',
    color: '#bbb',
    fontFamily: 'var(--font-display)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    lineHeight: 1.7,
    padding: '10px 10px 0'
  }
}
