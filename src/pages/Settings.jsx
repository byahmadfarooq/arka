import React, { useState, useEffect } from 'react'
import { Camera, Download, Upload, Trash2, Database } from 'lucide-react'
import { useArka } from '../context/ArkaContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

export default function Settings() {
  const { user, settings, updateSettings } = useArka()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({ ...settings })
      setPhotoUrl(settings.photo_url || '')
    }
  }, [settings])

  function f(k, v) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    await updateSettings({ ...form, photo_url: photoUrl })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const path = `profiles/${user.id}/photo.jpg`
    await supabase.storage.from('arka-media').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('arka-media').getPublicUrl(path)
    setPhotoUrl(data.publicUrl)
  }

  async function handleExport() {
    const uid = user.id
    const tables = ['posts', 'outbound_deals', 'inbound_leads', 'tasks', 'content_pipeline', 'lead_magnets', 'activity_log']
    const result = {}
    for (const t of tables) {
      const { data } = await supabase.from(t).select('*').eq('user_id', uid)
      result[t] = data || []
    }
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arka-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  async function handleLoadSample() {
    const uid = user.id
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    // Posts
    await supabase.from('posts').insert([
      { user_id: uid, type: 'text', caption: 'Most agency owners treat LinkedIn like a suggestion box.', published_at: '2025-01-15', tags: ['linkedin', 'agency'] },
      { user_id: uid, type: 'image', caption: 'ARKA LinkedIn Command Center is live.', published_at: '2025-01-10', tags: ['arka', 'launch'] },
      { user_id: uid, type: 'carousel', caption: '5 things killing your LinkedIn reach.', published_at: '2025-01-05', tags: ['linkedin', 'reach'] }
    ])

    // Outbound deals
    await supabase.from('outbound_deals').insert([
      { user_id: uid, lead_name: 'Daniel Cartland', company: 'Cartland Co', deal_value: 2500, stage: 'Closed Won', source: 'LinkedIn DM', stage_history: [{ stage: 'Closed Won', changed_at: new Date().toISOString() }] },
      { user_id: uid, lead_name: 'Sarah Malik', company: 'Malik Agency', deal_value: 1800, stage: 'Proposal Sent', source: 'Referral', stage_history: [{ stage: 'Proposal Sent', changed_at: new Date().toISOString() }] },
      { user_id: uid, lead_name: 'James Osei', company: 'Osei Brands', deal_value: 3200, stage: 'In Conversation', source: 'Cold Email', stage_history: [{ stage: 'In Conversation', changed_at: new Date().toISOString() }] },
      { user_id: uid, lead_name: 'Rania Aziz', company: 'Aziz Media', deal_value: 900, stage: 'Outreach Sent', source: 'LinkedIn DM', stage_history: [{ stage: 'Outreach Sent', changed_at: new Date().toISOString() }] },
      { user_id: uid, lead_name: 'Tom Healy', company: 'Healy SaaS', deal_value: 5000, stage: 'Negotiation', source: 'LinkedIn DM', stage_history: [{ stage: 'Negotiation', changed_at: new Date().toISOString() }] }
    ])

    // Tasks
    await supabase.from('tasks').insert([
      { user_id: uid, title: 'Write Monday newsletter', priority: 'High', status: 'todo', due_date: today },
      { user_id: uid, title: 'Follow up with Daniel Cartland', priority: 'Urgent', status: 'inprogress', due_date: yesterday },
      { user_id: uid, title: 'Record carousel video', priority: 'Normal', status: 'todo', due_date: nextWeek },
      { user_id: uid, title: 'Update lead magnet PDF', priority: 'Low', status: 'completed', total_seconds: 3600 },
      { user_id: uid, title: 'DM 10 new prospects', priority: 'High', status: 'todo', due_date: today }
    ])

    // Activity log entries
    await supabase.from('activity_log').insert([
      { user_id: uid, type: 'outbound', action: 'Won', label: 'Won - Daniel Cartland' },
      { user_id: uid, type: 'inbound', action: 'New Inquiry', label: 'New Inquiry - Via LinkedIn Post' },
      { user_id: uid, type: 'post', action: 'Published', label: 'Published: Most agency owners treat LinkedIn…' },
      { user_id: uid, type: 'task', action: 'Task Done', label: 'Completed: Update lead magnet PDF' }
    ])

    alert('Sample data loaded!')
    window.location.reload()
  }

  async function handleClearAll() {
    const uid = user.id
    const tables = ['posts', 'post_analytics_logs', 'outbound_deals', 'inbound_leads', 'tasks', 'content_pipeline', 'lead_magnets', 'activity_log']
    for (const t of tables) {
      await supabase.from(t).delete().eq('user_id', uid)
    }
    setConfirmClear(false)
    alert('All data cleared.')
    window.location.reload()
  }

  const er = form.exchange_rate || 278

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your ARKA workspace</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Profile */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={sectionHead}>Profile</h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ position: 'relative' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="avatar" style={{ width: 64, height: 64 }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--arka-orange-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--arka-orange)' }}>
                    {(form.name || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <label style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--arka-orange)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera size={11} color="white" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{form.name || 'Your Name'}</div>
              <div style={{ fontSize: 12, color: 'var(--arka-gray)' }}>{user?.email}</div>
            </div>
          </div>

          <div className="form-group"><label>Display Name</label><input value={form.name||''} onChange={e=>f('name',e.target.value)} /></div>
          <div className="form-group"><label>Email (read-only)</label><input value={user?.email||''} readOnly style={{ opacity: 0.6 }} /></div>
          <div className="form-group"><label>LinkedIn URL</label><input value={form.linkedin_url||''} onChange={e=>f('linkedin_url',e.target.value)} placeholder="https://linkedin.com/in/…" /></div>
        </div>

        {/* Finance */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={sectionHead}>Finance & Currency</h3>
          <div className="form-group"><label>Hourly Rate (USD)</label><input type="number" value={form.hourly_rate||''} onChange={e=>f('hourly_rate',Number(e.target.value))} /></div>
          <div className="form-group"><label>Total CAC Spend (USD)</label><input type="number" value={form.cac_spend||''} onChange={e=>f('cac_spend',Number(e.target.value))} /></div>
          <div className="form-group">
            <label>USD → PKR Exchange Rate</label>
            <input type="number" value={form.exchange_rate||''} onChange={e=>f('exchange_rate',Number(e.target.value))} />
          </div>
          <div className="callout" style={{ marginTop: 8 }}>
            <strong>$1,000 USD</strong> = <strong>PKR {(1000 * er).toLocaleString()}</strong>
          </div>
        </div>

        {/* Goals */}
        <div className="card" style={{ padding: 24, gridColumn: '1 / -1' }}>
          <h3 style={sectionHead}>Monthly Goals</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { key: 'goal_mrr', label: 'MRR Target ($)', type: 'number' },
              { key: 'goal_new_clients', label: 'New Clients / Month', type: 'number' },
              { key: 'goal_dms_per_week', label: 'DMs / Week', type: 'number' },
              { key: 'goal_posts_per_week', label: 'Posts / Week', type: 'number' },
              { key: 'goal_impressions', label: 'Monthly Impressions', type: 'number' },
              { key: 'goal_comments', label: 'Monthly Comments', type: 'number' },
              { key: 'goal_connections', label: 'New Connections / Month', type: 'number' },
              { key: 'goal_engagement_rate', label: 'Engagement Rate Goal (%)', type: 'number' },
              { key: 'goal_pipeline_deals', label: 'Pipeline Deals / Month', type: 'number' },
              { key: 'goal_revenue_pkr', label: 'Revenue Target (PKR)', type: 'number' }
            ].map(({ key, label, type }) => (
              <div className="form-group" key={key}>
                <label>{label}</label>
                <input type={type} value={form[key]||''} onChange={e=>f(key, type==='number'?Number(e.target.value):e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Data Management */}
        <div className="card" style={{ padding: 24, gridColumn: '1 / -1' }}>
          <h3 style={sectionHead}>Data Management</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={14} /> Export All Data
            </button>
            <button className="btn-secondary" onClick={handleLoadSample} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={14} /> Load Sample Data
            </button>
            <button className="btn-danger" onClick={() => setConfirmClear(true)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={14} /> Clear All Data
            </button>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 140 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>

      {/* Clear confirm modal */}
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear All Data">
        <p style={{ marginBottom: 20, color: 'var(--arka-gray)', fontSize: 14, lineHeight: 1.6 }}>
          This will permanently delete all your posts, deals, tasks, and leads. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => setConfirmClear(false)}>Cancel</button>
          <button className="btn-danger" onClick={handleClearAll}>Yes, Delete Everything</button>
        </div>
      </Modal>
    </div>
  )
}

const sectionHead = {
  fontFamily: 'var(--font-display)',
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--arka-gray)',
  marginBottom: 20
}
