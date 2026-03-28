import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, Users, TrendingUp, FileText,
  Send, Inbox, CheckSquare
} from 'lucide-react'
import { subDays, startOfMonth, format } from 'date-fns'
import { useArka } from '../context/ArkaContext'
import { supabase } from '../lib/supabase'
import MetricCard from '../components/MetricCard'
import ProgressBar from '../components/ProgressBar'
import ActivityFeed from '../components/ActivityFeed'
import Modal from '../components/Modal'

export default function Dashboard() {
  const { user, settings, logActivity } = useArka()
  const navigate = useNavigate()
  const [kpis, setKpis] = useState({ mrr: 0, activeClients: 0, pipelineValue: 0, postsThisMonth: 0 })
  const [activityStats, setActivityStats] = useState({ outbound: {}, inbound: {}, content: {} })
  const [recentPosts, setRecentPosts] = useState([])
  const [goalProgress, setGoalProgress] = useState({})
  const [loading, setLoading] = useState(true)

  // Quick action modals
  const [modal, setModal] = useState(null)
  const [formData, setFormData] = useState({})

  useEffect(() => {
    if (user) fetchDashboardData()
  }, [user])

  async function fetchDashboardData() {
    setLoading(true)
    const uid = user.id
    const now = new Date()
    const monthStart = startOfMonth(now)
    const sevenDaysAgo = subDays(now, 7)
    const thirtyDaysAgo = subDays(now, 30)

    // Parallel fetch
    const [wonDeals, allDeals, posts, tasks, contentLogs] = await Promise.all([
      supabase.from('outbound_deals').select('deal_value, stage').eq('user_id', uid),
      supabase.from('outbound_deals').select('deal_value, stage').eq('user_id', uid),
      supabase.from('posts').select('id, type, published_at').eq('user_id', uid).gte('published_at', format(monthStart, 'yyyy-MM-dd')),
      supabase.from('tasks').select('status').eq('user_id', uid),
      supabase.from('post_analytics_logs').select('impressions, reactions, comments').eq('user_id', uid).gte('log_date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
    ])

    // MRR: sum of won deals this month
    const mrr = (wonDeals.data || [])
      .filter(d => d.stage === 'Closed Won')
      .reduce((s, d) => s + (d.deal_value || 0), 0)

    // Active clients = won deals total
    const activeClients = (wonDeals.data || []).filter(d => d.stage === 'Closed Won').length

    // Pipeline value = all non-won/lost deals
    const pipelineValue = (allDeals.data || [])
      .filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage))
      .reduce((s, d) => s + (d.deal_value || 0), 0)

    // Posts this month
    const postsThisMonth = (posts.data || []).length

    // Content 30 days stats
    const logData = contentLogs.data || []
    const totalImpressions = logData.reduce((s, l) => s + (l.impressions || 0), 0)
    const totalEngagement = logData.reduce((s, l) => s + (l.reactions || 0) + (l.comments || 0), 0)
    const avgImpressions = logData.length > 0 ? Math.round(totalImpressions / logData.length) : 0

    setKpis({ mrr, activeClients, pipelineValue, postsThisMonth })
    setActivityStats({
      content: { impressions: totalImpressions, engagement: totalEngagement, avgPerPost: avgImpressions }
    })

    // Recent posts
    const { data: rp } = await supabase
      .from('posts')
      .select('*, post_analytics_logs(reactions, impressions, comments, day_marker)')
      .eq('user_id', uid)
      .order('published_at', { ascending: false })
      .limit(3)
    setRecentPosts(rp || [])

    setLoading(false)
  }

  async function handleQuickAction(action) {
    setModal(action)
    setFormData({})
  }

  async function submitQuickAction() {
    const uid = user.id
    if (modal === 'prospect') {
      await supabase.from('outbound_deals').insert({
        user_id: uid,
        lead_name: formData.lead_name || 'New Prospect',
        company: formData.company || '',
        deal_value: Number(formData.deal_value) || 0,
        stage: 'Prospecting',
        source: formData.source || 'LinkedIn DM',
        stage_history: [{ stage: 'Prospecting', changed_at: new Date().toISOString() }]
      })
      logActivity({ type: 'outbound', action: 'Prospecting', label: `Prospecting - ${formData.lead_name || 'New Prospect'}` })
    } else if (modal === 'inbound') {
      await supabase.from('inbound_leads').insert({
        user_id: uid,
        lead_name: formData.lead_name || 'New Lead',
        company: formData.company || '',
        deal_value: Number(formData.deal_value) || 0,
        stage: 'New Inquiry',
        source: formData.source || 'Other',
        stage_history: [{ stage: 'New Inquiry', changed_at: new Date().toISOString() }]
      })
      logActivity({ type: 'inbound', action: 'New Inquiry', label: `New Inquiry - ${formData.lead_name || 'New Lead'}` })
    } else if (modal === 'task') {
      await supabase.from('tasks').insert({
        user_id: uid,
        title: formData.title || 'New Task',
        priority: formData.priority || 'Normal',
        status: 'todo'
      })
      logActivity({ type: 'task', action: 'Created', label: `Task: ${formData.title || 'New Task'}` })
    } else if (modal === 'post') {
      await supabase.from('content_pipeline').insert({
        user_id: uid,
        title: formData.title || 'New Post Idea',
        format: formData.format || 'Text',
        status: 'Ideas'
      })
    }
    setModal(null)
    fetchDashboardData()
  }

  const er = settings?.exchange_rate || 278
  const fmtUSD = v => `$${Number(v || 0).toLocaleString()}`
  const fmtPKR = v => `PKR ${Math.round((v || 0) * er).toLocaleString()}`

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your brand command center</p>
      </div>

      {/* Row 1 — KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <MetricCard
          label="Total MRR"
          value={fmtUSD(kpis.mrr)}
          subLabel={`${fmtPKR(kpis.mrr)}`}
          icon={DollarSign}
          color="orange"
        />
        <MetricCard
          label="Active Clients"
          value={kpis.activeClients}
          subLabel={`${kpis.activeClients} total clients`}
          icon={Users}
          color="blue"
        />
        <MetricCard
          label="Pipeline Value"
          value={fmtUSD(kpis.pipelineValue)}
          subLabel={fmtPKR(kpis.pipelineValue)}
          icon={TrendingUp}
          color="orange"
        />
        <MetricCard
          label="Posts This Month"
          value={kpis.postsThisMonth}
          subLabel={`${kpis.postsThisMonth} total posts`}
          icon={FileText}
          color="purple"
        />
      </div>

      {/* Row 2 — Activity summary panels */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <ActivitySummaryPanel title="OUTBOUND (7 DAYS)" stats={activityStats.outbound || {}} type="outbound" userId={user?.id} />
        <ActivitySummaryPanel title="INBOUND (7 DAYS)" stats={activityStats.inbound || {}} type="inbound" userId={user?.id} />
        <ContentSummaryPanel stats={activityStats.content || {}} />
      </div>

      {/* Row 3 — Recent Activity + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.65fr', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="section-header">
            <span className="section-title">Recent Activity</span>
          </div>
          <ActivityFeed limit={15} />
        </div>

        <div>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <span className="section-title">Quick Actions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <QuickBtn icon={Send} label="Add Prospect" color="orange" onClick={() => handleQuickAction('prospect')} />
            <QuickBtn icon={Inbox} label="Log Inbound Lead" color="blue" onClick={() => handleQuickAction('inbound')} />
            <QuickBtn icon={Users} label="Add Client" color="green" onClick={() => navigate('/outbound')} />
            <QuickBtn icon={FileText} label="Schedule Post" color="purple" onClick={() => handleQuickAction('post')} />
            <QuickBtn icon={CheckSquare} label="New Task" color="orange" onClick={() => handleQuickAction('task')} />
          </div>
        </div>
      </div>

      {/* Row 4 — Goal Progress */}
      {settings && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div className="section-header">
            <span className="section-title">Goal Progress</span>
          </div>
          <div className="grid-2" style={{ gap: 24 }}>
            <ProgressBar label="Monthly MRR" current={kpis.mrr} target={settings.goal_mrr} unit="$" />
            <ProgressBar label="New Clients / Month" current={kpis.activeClients} target={settings.goal_new_clients} />
            <ProgressBar label="Posts This Week (avg)" current={kpis.postsThisMonth > 0 ? Math.round(kpis.postsThisMonth / 4) : 0} target={settings.goal_posts_per_week} />
            <ProgressBar label="Monthly Impressions" current={activityStats.content?.impressions || 0} target={settings.goal_impressions} />
          </div>
        </div>
      )}

      {/* Row 5 — Content Preview Strip */}
      {recentPosts.length > 0 && (
        <div>
          <div className="section-header">
            <span className="section-title">Recent Posts</span>
          </div>
          <div className="grid-3">
            {recentPosts.map(post => (
              <PostPreviewCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Modals */}
      <Modal open={modal === 'prospect'} onClose={() => setModal(null)} title="Add Prospect">
        <QuickProspectForm data={formData} onChange={setFormData} onSubmit={submitQuickAction} onCancel={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'inbound'} onClose={() => setModal(null)} title="Log Inbound Lead">
        <QuickLeadForm data={formData} onChange={setFormData} onSubmit={submitQuickAction} onCancel={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'task'} onClose={() => setModal(null)} title="New Task">
        <QuickTaskForm data={formData} onChange={setFormData} onSubmit={submitQuickAction} onCancel={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'post'} onClose={() => setModal(null)} title="Add to Content Pipeline">
        <QuickPostForm data={formData} onChange={setFormData} onSubmit={submitQuickAction} onCancel={() => setModal(null)} />
      </Modal>
    </div>
  )
}

function QuickBtn({ icon: Icon, label, color, onClick }) {
  const bgMap = { orange: 'var(--arka-orange-light)', blue: '#DBEAFE', green: '#DCFCE7', purple: '#EDE9FE' }
  const colorMap = { orange: 'var(--arka-orange)', blue: 'var(--arka-blue)', green: 'var(--arka-green)', purple: 'var(--arka-purple)' }
  return (
    <button className="quick-action-btn" onClick={onClick}>
      <div className="quick-action-icon" style={{ background: bgMap[color] || bgMap.orange }}>
        <Icon size={16} color={colorMap[color] || colorMap.orange} />
      </div>
      <span className="quick-action-label">{label}</span>
    </button>
  )
}

function ActivitySummaryPanel({ title, userId, type }) {
  const [stats, setStats] = useState({ a: 0, b: 0, c: 0 })

  useEffect(() => {
    if (!userId) return
    const sevenDaysAgo = subDays(new Date(), 7)
    async function load() {
      if (type === 'outbound') {
        const { data } = await supabase
          .from('activity_log')
          .select('action')
          .eq('user_id', userId)
          .eq('type', 'outbound')
          .gte('created_at', sevenDaysAgo.toISOString())
        const d = data || []
        setStats({
          a: d.filter(x => x.action === 'DM Sent').length,
          b: d.filter(x => x.action === 'Stage Changed').length,
          c: d.filter(x => x.action === 'Calls Booked').length
        })
      } else if (type === 'inbound') {
        const { data } = await supabase
          .from('inbound_leads')
          .select('stage, created_at')
          .eq('user_id', userId)
          .gte('created_at', sevenDaysAgo.toISOString())
        const d = data || []
        setStats({ a: d.length, b: d.filter(x => ['Qualifying', 'Discovery Call Booked'].includes(x.stage)).length, c: d.filter(x => x.stage === 'Discovery Call Booked').length })
      }
    }
    load()
  }, [userId, type])

  const labels = type === 'outbound'
    ? ['DMs Sent', 'Replies', 'Calls Booked']
    : ['New Leads', 'Qualified', 'Calls Booked']

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="section-title" style={{ marginBottom: 16 }}>{title}</div>
      <div className="stats-row">
        <div className="stat-item"><div className="stat-value">{stats.a}</div><div className="stat-label">{labels[0]}</div></div>
        <div className="stat-item"><div className="stat-value">{stats.b}</div><div className="stat-label">{labels[1]}</div></div>
        <div className="stat-item"><div className="stat-value">{stats.c}</div><div className="stat-label">{labels[2]}</div></div>
      </div>
    </div>
  )
}

function ContentSummaryPanel({ stats }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="section-title" style={{ marginBottom: 16 }}>CONTENT (30 DAYS)</div>
      <div className="stats-row">
        <div className="stat-item"><div className="stat-value">{(stats.impressions || 0).toLocaleString()}</div><div className="stat-label">Impressions</div></div>
        <div className="stat-item"><div className="stat-value">{(stats.engagement || 0).toLocaleString()}</div><div className="stat-label">Engagement</div></div>
        <div className="stat-item"><div className="stat-value">{(stats.avgPerPost || 0).toLocaleString()}</div><div className="stat-label">Avg/Post</div></div>
      </div>
    </div>
  )
}

function PostPreviewCard({ post }) {
  const latestLog = post.post_analytics_logs?.sort((a, b) => b.day_marker - a.day_marker)[0]
  const typeColors = { text: 'gray', image: 'blue', carousel: 'orange' }

  return (
    <div className="card" style={{ padding: 16, overflow: 'hidden' }}>
      {post.type === 'image' && post.image_url && (
        <img src={post.image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className={`badge badge-${typeColors[post.type] || 'gray'}`}>{post.type}</span>
        <span style={{ fontSize: 11, color: 'var(--arka-gray)' }}>{post.published_at}</span>
      </div>
      {post.caption && (
        <p style={{
          fontSize: 13,
          color: 'var(--arka-black)',
          lineHeight: 1.5,
          borderLeft: '3px solid var(--arka-orange)',
          paddingLeft: 10,
          marginBottom: 10
        }}>
          {post.caption.slice(0, 120)}{post.caption.length > 120 ? '…' : ''}
        </p>
      )}
      {latestLog && (
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--arka-gray)' }}>
          <span>❤ {latestLog.reactions || 0}</span>
          <span>💬 {latestLog.comments || 0}</span>
          <span>👁 {(latestLog.impressions || 0).toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}

function QuickProspectForm({ data, onChange, onSubmit, onCancel }) {
  const f = (k, v) => onChange(p => ({ ...p, [k]: v }))
  return (
    <>
      <div className="form-group"><label>Lead Name</label><input value={data.lead_name||''} onChange={e=>f('lead_name',e.target.value)} placeholder="Daniel Cartland" /></div>
      <div className="form-row">
        <div className="form-group"><label>Company</label><input value={data.company||''} onChange={e=>f('company',e.target.value)} /></div>
        <div className="form-group"><label>Deal Value ($)</label><input type="number" value={data.deal_value||''} onChange={e=>f('deal_value',e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Source</label><select value={data.source||'LinkedIn DM'} onChange={e=>f('source',e.target.value)}><option>LinkedIn DM</option><option>Referral</option><option>Cold Email</option><option>Other</option></select></div>
      <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onSubmit}>Add Prospect</button>
      </div>
    </>
  )
}

function QuickLeadForm({ data, onChange, onSubmit, onCancel }) {
  const f = (k, v) => onChange(p => ({ ...p, [k]: v }))
  return (
    <>
      <div className="form-group"><label>Lead Name</label><input value={data.lead_name||''} onChange={e=>f('lead_name',e.target.value)} /></div>
      <div className="form-row">
        <div className="form-group"><label>Company</label><input value={data.company||''} onChange={e=>f('company',e.target.value)} /></div>
        <div className="form-group"><label>Deal Value ($)</label><input type="number" value={data.deal_value||''} onChange={e=>f('deal_value',e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Source</label><select value={data.source||'LinkedIn Post'} onChange={e=>f('source',e.target.value)}><option>LinkedIn Post</option><option>DM</option><option>Referral</option><option>Website</option><option>Other</option></select></div>
      <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onSubmit}>Log Lead</button>
      </div>
    </>
  )
}

function QuickTaskForm({ data, onChange, onSubmit, onCancel }) {
  const f = (k, v) => onChange(p => ({ ...p, [k]: v }))
  return (
    <>
      <div className="form-group"><label>Task Title</label><input value={data.title||''} onChange={e=>f('title',e.target.value)} placeholder="Write Monday newsletter" /></div>
      <div className="form-row">
        <div className="form-group"><label>Priority</label><select value={data.priority||'Normal'} onChange={e=>f('priority',e.target.value)}><option>Urgent</option><option>High</option><option>Normal</option><option>Low</option></select></div>
        <div className="form-group"><label>Due Date</label><input type="date" value={data.due_date||''} onChange={e=>f('due_date',e.target.value)} /></div>
      </div>
      <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onSubmit}>Add Task</button>
      </div>
    </>
  )
}

function QuickPostForm({ data, onChange, onSubmit, onCancel }) {
  const f = (k, v) => onChange(p => ({ ...p, [k]: v }))
  return (
    <>
      <div className="form-group"><label>Post Title / Hook</label><input value={data.title||''} onChange={e=>f('title',e.target.value)} placeholder="5 things killing your LinkedIn reach" /></div>
      <div className="form-row">
        <div className="form-group"><label>Format</label><select value={data.format||'Text'} onChange={e=>f('format',e.target.value)}><option>Text</option><option>Image</option><option>Carousel</option></select></div>
      </div>
      <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onSubmit}>Add to Pipeline</button>
      </div>
    </>
  )
}
