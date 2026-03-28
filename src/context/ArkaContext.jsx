import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ArkaContext = createContext(null)

export function ArkaProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoadingAuth(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) fetchSettings()
  }, [user])

  async function fetchSettings() {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setSettings(data)
    } else {
      // Create default settings
      const defaults = {
        user_id: user.id,
        name: user.email?.split('@')[0] || 'User',
        email: user.email,
        hourly_rate: 50,
        cac_spend: 0,
        exchange_rate: 278,
        goal_mrr: 1000,
        goal_new_clients: 1,
        goal_dms_per_week: 30,
        goal_posts_per_week: 7,
        goal_impressions: 50000,
        goal_comments: 100,
        goal_connections: 50,
        goal_engagement_rate: 3.0,
        goal_pipeline_deals: 5,
        goal_revenue_pkr: 500000
      }
      const { data: created } = await supabase
        .from('user_settings')
        .insert(defaults)
        .select()
        .single()
      if (created) setSettings(created)
    }
  }

  async function updateSettings(updates) {
    if (!user) return
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ ...updates, user_id: user.id, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (data) setSettings(data)
    return { data, error }
  }

  async function logActivity({ type, action, label, ref_id }) {
    if (!user) return
    await supabase.from('activity_log').insert({
      user_id: user.id,
      type,
      action,
      label,
      ref_id: ref_id || null
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSettings(null)
  }

  const value = {
    user,
    session,
    settings,
    loadingAuth,
    fetchSettings,
    updateSettings,
    logActivity,
    signOut,
    exchangeRate: settings?.exchange_rate || 278
  }

  return <ArkaContext.Provider value={value}>{children}</ArkaContext.Provider>
}

export function useArka() {
  const ctx = useContext(ArkaContext)
  if (!ctx) throw new Error('useArka must be used inside ArkaProvider')
  return ctx
}
