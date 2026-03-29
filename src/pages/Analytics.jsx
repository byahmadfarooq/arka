import React, { useEffect, useState } from 'react'
import { subDays, format, eachDayOfInterval, startOfMonth } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useArka } from '../context/ArkaContext'
import ProgressBar from '../components/ProgressBar'

const COLORS = ['#F97316', '#2563EB', '#16A34A', '#7C3AED', '#DC2626']

export default function Analytics() {
  const { user, settings } = useArka()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState(null)
  const [postLogs, setPostLogs] = useState([])

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const uid = user.id

    const [posts, analyticsLogs, outboundDeals, inboundLeads, tasks] = await Promise.all([
      supabase.from('posts').select('*').eq('user_id', uid).order('published_at', { ascending: false }),
      supabase.from('post_analytics_logs').select('*').eq('user_id', uid),
      supabase.from('outbound_deals').select('*').eq('user_id', uid),
      supabase.from('inbound_leads').select('*').eq('user_id', uid),
      supabase.from('tasks').select('*').eq('user_id', uid)
    ])

    const postsData = posts.data || []
    const logs = analyticsLogs.data || []
    const outbound = outboundDeals.data || []
    const inbound = inboundLeads.data || []
    const tasksData = tasks.data || []

    // Weekly impressions (last 8 weeks)
    // For each week, take the highest impression value per post (not sum of all logs)
    // to avoid double-counting multiple snapshots of the same post
    const weeklyImpressions = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = subDays(new Date(), i * 7 + 7)
      const weekEnd = subDays(new Date(), i * 7)
      const bestPerPost = {}
      logs.forEach(l => {
        const d = new Date(l.log_date)
        if (d >= weekStart && d <= weekEnd) {
          bestPerPost[l.post_id] = Math.max(bestPerPost[l.post_id] || 0, l.impressions || 0)
        }
      })
      weeklyImpressions.push({
        week: format(weekEnd, 'MMM d'),
        impressions: Object.values(bestPerPost).reduce((s, v) => s + v, 0)
      })
    }

    // Reactions per post (last 20)
    const reactionsPerPost = postsData.slice(0, 20).map(p => {
      const pLogs = logs.filter(l => l.post_id === p.id).sort((a, b) => b.day_marker - a.day_marker)
      const latest = pLogs[0]
      return {
        name: (p.caption || '').slice(0, 20) + '…',
        reactions: latest?.reactions || 0
      }
    })

    // Post type breakdown
    const typeCount = postsData.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1
      return acc
    }, {})
    const typeBreakdown = Object.entries(typeCount).map(([name, value]) => ({ name, value }))

    // Top posts by impressions
    const topByImpressions = postsData.map(p => {
      const pLogs = logs.filter(l => l.post_id === p.id).sort((a, b) => b.day_marker - a.day_marker)
      const latest = pLogs[0]
      return { ...p, impressions: latest?.impressions || 0, reactions: latest?.reactions || 0 }
    }).sort((a, b) => b.impressions - a.impressions).slice(0, 3)

    // Pipeline analytics
    const outboundStages = {}
    const inboundStages = {}
    ;['Prospecting','Outreach Sent','In Conversation','Proposal Sent','Negotiation','Closed Won','Closed Lost'].forEach(s => { outboundStages[s] = 0 })
    ;['New Inquiry','Qualifying','Discovery Call Booked','Proposal Sent','Negotiation','Closed Won','Closed Lost'].forEach(s => { inboundStages[s] = 0 })
    outbound.forEach(d => { if (outboundStages[d.stage] !== undefined) outboundStages[d.stage]++ })
    inbound.forEach(l => { if (inboundStages[l.stage] !== undefined) inboundStages[l.stage]++ })

    const outboundByStage = Object.entries(outboundStages).map(([stage, count]) => ({ stage: stage.replace(' ', '\n'), count }))
    const inboundByStage = Object.entries(inboundStages).map(([stage, count]) => ({ stage: stage.replace(' ', '\n'), count }))

    // Time economics
    const totalSeconds = tasksData.reduce((s, t) => s + (t.total_seconds || 0), 0)
    const thisWeekSeconds = tasksData
      .filter(t => t.updated_at && new Date(t.updated_at) >= subDays(new Date(), 7))
      .reduce((s, t) => s + (t.total_seconds || 0), 0)

    // Hours per day last 14 days
    const hoursPerDay = []
    for (let i = 13; i >= 0; i--) {
      const day = subDays(new Date(), i)
      const dayStr = format(day, 'yyyy-MM-dd')
      const daySeconds = tasksData.reduce((s, t) => {
        const tLogs = t.time_logs || []
        const dayLogs = tLogs.filter(l => l.started_at?.startsWith(dayStr))
        return s + dayLogs.reduce((ss, l) => ss + (l.duration_seconds || 0), 0)
      }, 0)
      hoursPerDay.push({ day: format(day, 'MMM d'), hours: Math.round(daySeconds / 360) / 10 })
    }

    setData({
      weeklyImpressions, reactionsPerPost, typeBreakdown, topByImpressions,
      outboundByStage, inboundByStage,
      outbound, inbound,
      totalSeconds, thisWeekSeconds,
      hoursPerDay,
      tasksData,
      postsData
    })
    setLoading(false)
  }

  async function handleSelectPost(postId) {
    setSelectedPost(postId)
    const { data: logs } = await supabase
      .from('post_analytics_logs')
      .select('*')
      .eq('post_id', postId)
      .order('day_marker', { ascending: true })
    setPostLogs(logs || [])
  }

  if (loading) return (
    <div>
      <div className="page-header"><h1 className="page-title">Analytics</h1></div>
      <div className="grid-2" style={{ gap: 20 }}>
        {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 12 }} />)}
      </div>
    </div>
  )

  const er = settings?.exchange_rate || 278
  const hourlyRate = settings?.hourly_rate || 50
  const totalHours = Math.round(data.totalSeconds / 360) / 10
  const thisWeekHours = Math.round(data.thisWeekSeconds / 360) / 10
  const earned = totalHours * hourlyRate
  const earnedPKR = earned * er

  const outWon = data.outbound.filter(d => d.stage === 'Closed Won').length
  const outTotal = data.outbound.filter(d => ['Closed Won','Closed Lost'].includes(d.stage)).length
  const outWinRate = outTotal > 0 ? Math.round((outWon/outTotal)*100) : 0

  const inWon = data.inbound.filter(l => l.stage === 'Closed Won').length
  const inTotal = data.inbound.filter(l => ['Closed Won','Closed Lost'].includes(l.stage)).length
  const inConvRate = inTotal > 0 ? Math.round((inWon/inTotal)*100) : 0

  const topByTime = data.tasksData.sort((a,b)=>(b.total_seconds||0)-(a.total_seconds||0)).slice(0,5)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Your brand by the numbers</p>
      </div>

      {/* Content Performance */}
      <Section title="Content Performance">
        <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Weekly Impressions</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.weeklyImpressions}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="impressions" stroke="var(--arka-orange)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Post Type Breakdown</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.typeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {data.typeBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Reactions Per Post (Last 20)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.reactionsPerPost}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="reactions" fill="var(--arka-orange)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {data.topByImpressions.length > 0 && (
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Top Posts by Impressions</div>
            {data.topByImpressions.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--arka-gray-light)' : 'none' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--arka-orange)', fontWeight: 700, minWidth: 24 }}>#{i+1}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{(p.caption||'').slice(0,80)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--arka-orange)' }}>{(p.impressions||0).toLocaleString()} impr</span>
                <span style={{ fontSize: 12, color: 'var(--arka-gray)' }}>{p.reactions} reactions</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Per-Post Growth */}
      <Section title="Per-Post Growth Tracker">
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Select Post</label>
            <select value={selectedPost || ''} onChange={e => handleSelectPost(e.target.value)} style={{ maxWidth: 400 }}>
              <option value="">Choose a post…</option>
              {data.postsData.map(p => (
                <option key={p.id} value={p.id}>{p.published_at} — {(p.caption||'Untitled').slice(0,60)}</option>
              ))}
            </select>
          </div>
          {selectedPost && postLogs.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={postLogs.map(l => ({ day: `D${l.day_marker}`, reactions: l.reactions, impressions: l.impressions, comments: l.comments }))}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="reactions" stroke="var(--arka-orange)" strokeWidth={2} />
                <Line type="monotone" dataKey="impressions" stroke="var(--arka-blue)" strokeWidth={2} />
                <Line type="monotone" dataKey="comments" stroke="var(--arka-green)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {selectedPost && postLogs.length === 0 && (
            <p style={{ color: 'var(--arka-gray)', fontSize: 13 }}>No analytics logs for this post yet. Use "Log Update" to add snapshots.</p>
          )}
        </div>
      </Section>

      {/* Goal Progress */}
      {settings && (
        <Section title="Goal Progress">
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div className="grid-2" style={{ gap: 20 }}>
              {[
                { label: 'Monthly MRR', current: data.outbound.filter(d=>d.stage==='Closed Won').reduce((s,d)=>s+(d.deal_value||0),0), target: settings.goal_mrr, unit: '$' },
                { label: 'Monthly Posts', current: data.postsData.filter(p=>p.published_at>=format(startOfMonth(new Date()),'yyyy-MM-dd')).length, target: settings.goal_posts_per_week*4 },
                { label: 'Monthly Impressions', current: (data.weeklyImpressions.slice(-4).reduce((s,w)=>s+w.impressions,0)), target: settings.goal_impressions },
                { label: 'New Clients / Month', current: outWon, target: settings.goal_new_clients }
              ].map((g,i) => (
                <ProgressBar key={i} label={g.label} current={g.current} target={g.target} unit={g.unit} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Pipeline Analytics */}
      <Section title="Pipeline Analytics">
        <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>Outbound by Stage</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--arka-orange)' }}>{data.outbound.length}</div><div style={{ fontSize: 11, color: 'var(--arka-gray)' }}>Total Deals</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--arka-green)' }}>{outWinRate}%</div><div style={{ fontSize: 11, color: 'var(--arka-gray)' }}>Win Rate</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--arka-orange)' }}>${data.outbound.filter(d=>d.stage==='Closed Won').reduce((s,d)=>s+(d.deal_value||0),0).toLocaleString()}</div><div style={{ fontSize: 11, color: 'var(--arka-gray)' }}>Total Won</div></div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.outboundByStage}>
                <XAxis dataKey="stage" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--arka-orange)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>Inbound by Stage</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--arka-blue)' }}>{data.inbound.length}</div><div style={{ fontSize: 11, color: 'var(--arka-gray)' }}>Total Leads</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--arka-green)' }}>{inConvRate}%</div><div style={{ fontSize: 11, color: 'var(--arka-gray)' }}>Conversion</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--arka-blue)' }}>${data.inbound.filter(l=>l.stage==='Closed Won').reduce((s,l)=>s+(l.deal_value||0),0).toLocaleString()}</div><div style={{ fontSize: 11, color: 'var(--arka-gray)' }}>Total Won</div></div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.inboundByStage}>
                <XAxis dataKey="stage" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--arka-blue)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* Time Economics */}
      <Section title="Time Economics">
        <div className="grid-4" style={{ gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Total Hours Logged', value: `${totalHours}h` },
            { label: 'This Week', value: `${thisWeekHours}h` },
            { label: 'USD Earned (est.)', value: `$${earned.toLocaleString()}` },
            { label: 'PKR Earned (est.)', value: `PKR ${Math.round(earnedPKR).toLocaleString()}` }
          ].map((s,i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div className="display-label" style={{ marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--arka-orange)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Hours Per Day (Last 14 Days)</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.hoursPerDay}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="hours" fill="var(--arka-orange)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Top Tasks by Time</div>
            {topByTime.length === 0 ? (
              <p style={{ color: 'var(--arka-gray)', fontSize: 13 }}>No time tracked yet.</p>
            ) : topByTime.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--arka-gray-light)' : 'none' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--arka-orange)', fontWeight: 700, minWidth: 20 }}>#{i+1}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--arka-orange)' }}>
                  {Math.floor((t.total_seconds||0)/3600)}h {Math.floor(((t.total_seconds||0)%3600)/60)}m
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <span className="section-title">{title}</span>
      </div>
      {children}
    </div>
  )
}
