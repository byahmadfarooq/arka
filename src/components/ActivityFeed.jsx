import React, { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Send, Inbox, FileText, CheckSquare, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useArka } from '../context/ArkaContext'

const TYPE_META = {
  outbound:    { icon: Send,       color: '#F97316', bg: '#FEE8D6' },
  inbound:     { icon: Inbox,      color: '#2563EB', bg: '#DBEAFE' },
  post:        { icon: FileText,   color: '#7C3AED', bg: '#EDE9FE' },
  task:        { icon: CheckSquare,color: '#16A34A', bg: '#DCFCE7' },
  lead_magnet: { icon: BookOpen,   color: '#F97316', bg: '#FEE8D6' }
}

export default function ActivityFeed({ limit = 20 }) {
  const { user } = useArka()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchLogs()
  }, [user])

  async function fetchLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    setLogs(data || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '16px 0' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 40, marginBottom: 8, borderRadius: 8 }} />
        ))}
      </div>
    )
  }

  if (!logs.length) {
    return (
      <div className="empty-state" style={{ padding: '32px 0' }}>
        <span className="empty-state-text">No activity yet. Start by adding a prospect or logging a post.</span>
      </div>
    )
  }

  return (
    <div>
      {logs.map(log => {
        const meta = TYPE_META[log.type] || TYPE_META.task
        const Icon = meta.icon
        return (
          <div key={log.id} className="activity-row">
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: meta.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Icon size={14} color={meta.color} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--arka-black)', flex: 1 }}>{log.label}</span>
            <span className="activity-time">
              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
                .replace('about ', '')
                .replace(' ago', ' Ago')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
