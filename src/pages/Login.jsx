import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useArka } from '../context/ArkaContext'

export default function Login() {
  const { session } = useArka()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let result
    if (mode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password })
    } else {
      result = await supabase.auth.signUp({ email, password })
    }

    if (result.error) {
      setError(result.error.message)
    }
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card} className="bracket-panel">
        {/* Logo */}
        <div style={styles.logo}>
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
            <path d="M10 0 L20 14 L0 14 Z" fill="none" stroke="#F97316" strokeWidth="1.5"/>
          </svg>
          <span style={styles.wordmark}>ARKA</span>
        </div>
        <p style={styles.tagline}>Your brand. Fully operated.</p>

        <h2 style={styles.heading}>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <p style={styles.subheading}>
          {mode === 'login'
            ? 'Sign in to your ARKA workspace'
            : 'Set up your ARKA workspace'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="ahmad@arka.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={styles.error}>{error}</div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading
              ? 'Please wait…'
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={styles.switchMode}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                style={styles.linkBtn}
                onClick={() => { setMode('signup'); setError('') }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                style={styles.linkBtn}
                onClick={() => { setMode('login'); setError('') }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>

      <p style={styles.footer}>NOT ARCHAEOLOGY. YOUR MONDAY SHOULD START WITH WORK.</p>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--arka-cream)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    gap: '24px'
  },
  card: {
    background: 'var(--arka-white)',
    border: 'var(--card-border)',
    borderRadius: 'var(--card-radius)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '400px'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '22px',
    color: 'var(--arka-black)',
    letterSpacing: '0.04em'
  },
  tagline: {
    fontFamily: 'var(--font-body)',
    fontSize: '10px',
    color: 'var(--arka-gray)',
    marginBottom: '28px'
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--arka-black)',
    marginBottom: '4px'
  },
  subheading: {
    fontSize: '13px',
    color: 'var(--arka-gray)',
    marginBottom: '24px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column'
  },
  error: {
    background: '#FEE2E2',
    color: 'var(--arka-red)',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '12px'
  },
  switchMode: {
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--arka-gray)',
    marginTop: '20px'
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--arka-orange)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '13px',
    padding: 0
  },
  footer: {
    fontSize: '10px',
    color: 'var(--arka-gray)',
    letterSpacing: '0.08em',
    fontFamily: 'var(--font-display)',
    textTransform: 'uppercase',
    opacity: 0.6
  }
}
