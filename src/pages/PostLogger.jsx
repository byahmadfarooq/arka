import React, { useEffect, useState } from 'react'
import { Plus, ChevronDown, ChevronUp, Trash2, Edit3, Link } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useArka } from '../context/ArkaContext'
import Modal from '../components/Modal'
import TagInput from '../components/TagInput'
import FileUpload from '../components/FileUpload'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const POST_TYPES = ['text', 'image', 'carousel']
const DAY_MARKERS = [0, 1, 7, 14, 30, 60, 90]

/** Extract embed src from iframe code OR return URL directly if it's already a LinkedIn embed URL */
function parseLinkedInEmbed(raw) {
  if (!raw || !raw.trim()) return ''
  const trimmed = raw.trim()
  // Already an embed URL
  if (trimmed.startsWith('https://www.linkedin.com/embed/')) return trimmed
  // iframe tag — extract src
  const match = trimmed.match(/src=["']([^"']+)["']/)
  if (match) return match[1]
  return ''
}

export default function PostLogger() {
  const { user, logActivity } = useArka()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [logModal, setLogModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [filter, setFilter] = useState({ type: '', search: '' })
  const [sortBy, setSortBy] = useState('date')

  useEffect(() => { if (user) fetchPosts() }, [user])

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('posts')
      .select('*, post_analytics_logs(*)')
      .eq('user_id', user.id)
      .order('published_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this post?')) return
    await supabase.from('post_analytics_logs').delete().eq('post_id', id)
    await supabase.from('posts').delete().eq('id', id)
    fetchPosts()
  }

  const filtered = posts.filter(p => {
    if (filter.type && p.type !== filter.type) return false
    if (filter.search && !p.caption?.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'date') return new Date(b.published_at) - new Date(a.published_at)
    const aLog = a.post_analytics_logs?.sort((x, y) => y.day_marker - x.day_marker)[0]
    const bLog = b.post_analytics_logs?.sort((x, y) => y.day_marker - x.day_marker)[0]
    if (sortBy === 'impressions') return (bLog?.impressions || 0) - (aLog?.impressions || 0)
    if (sortBy === 'reactions') return (bLog?.reactions || 0) - (aLog?.reactions || 0)
    return 0
  })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Post Logger</h1>
          <p className="page-subtitle">Log and track every LinkedIn post</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Log Post
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input placeholder="Search posts…" value={filter.search} onChange={e => setFilter(p => ({ ...p, search: e.target.value }))} style={{ width: 200 }} />
        <select value={filter.type} onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}>
          <option value="">All Types</option>
          {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date">Sort: Date</option>
          <option value="impressions">Sort: Impressions</option>
          <option value="reactions">Sort: Reactions</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{filtered.length} posts</span>
      </div>

      {/* Posts */}
      {loading ? (
        <div>{[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, marginBottom: 12 }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>📝</div>
          <div className="empty-state-title">No Posts Logged</div>
          <div className="empty-state-text">Start tracking your content. Every post is data.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              expanded={expanded[post.id]}
              onToggle={() => setExpanded(p => ({ ...p, [post.id]: !p[post.id] }))}
              onLogUpdate={() => setLogModal(post)}
              onEdit={() => setEditModal(post)}
              onDelete={() => handleDelete(post.id)}
            />
          ))}
        </div>
      )}

      {/* Add Post Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Log New Post" maxWidth={660}>
        <AddPostForm
          userId={user?.id}
          onSave={() => { setShowAdd(false); fetchPosts() }}
          onCancel={() => setShowAdd(false)}
          logActivity={logActivity}
        />
      </Modal>

      {/* Log Update Modal */}
      <Modal open={!!logModal} onClose={() => setLogModal(null)} title="Log Analytics Update">
        {logModal && (
          <LogUpdateForm
            post={logModal}
            onSave={() => { setLogModal(null); fetchPosts() }}
            onCancel={() => setLogModal(null)}
          />
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Post" maxWidth={660}>
        {editModal && (
          <AddPostForm
            userId={user?.id}
            initial={editModal}
            onSave={() => { setEditModal(null); fetchPosts() }}
            onCancel={() => setEditModal(null)}
            logActivity={logActivity}
          />
        )}
      </Modal>
    </div>
  )
}

function PostCard({ post, expanded, onToggle, onLogUpdate, onEdit, onDelete }) {
  const logs = (post.post_analytics_logs || []).sort((a, b) => a.day_marker - b.day_marker)
  const latestLog = logs[logs.length - 1]
  const day0 = logs.find(l => l.day_marker === 0) || logs[0]
  const typeColorMap = { text: 'gray', image: 'blue', carousel: 'orange' }

  const delta = (current, base) => {
    if (base == null || current == null) return null
    const d = current - base
    return d > 0 ? `+${d}` : d < 0 ? String(d) : null
  }

  const chartData = logs.map(l => ({
    day: `D${l.day_marker}`,
    reactions: l.reactions,
    impressions: l.impressions,
    comments: l.comments
  }))

  const embedUrl = post.embed_url || ''

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Thumbnail / embed preview */}
        {embedUrl ? (
          /* LinkedIn live embed */
          <div style={{ flexShrink: 0, width: 200, borderRadius: 8, overflow: 'hidden', border: '1px solid #E0DBD3' }}>
            <iframe
              src={embedUrl}
              height={160}
              width={200}
              frameBorder={0}
              allowFullScreen
              title="LinkedIn post"
              style={{ display: 'block' }}
            />
          </div>
        ) : post.type === 'image' && post.image_url ? (
          <img src={post.image_url} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
        ) : post.type === 'carousel' && post.slides?.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {post.slides.slice(0, 3).map((s, i) => (
              <img key={i} src={s.url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }} />
            ))}
          </div>
        ) : null}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span className={`badge badge-${typeColorMap[post.type] || 'gray'}`}>{post.type}</span>
            {embedUrl && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#0077B5', fontWeight: 500 }}>
                <Link size={10} /> LinkedIn Embed
              </span>
            )}
            <span style={{ fontSize: 12, color: '#888' }}>{post.published_at}</span>
            {(post.tags || []).map(t => <span key={t} className="tag-pill">{t}</span>)}
          </div>

          {post.caption && (
            <p style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.5, borderLeft: '3px solid #F97316', paddingLeft: 10, marginBottom: 10 }}>
              {expanded ? post.caption : post.caption.slice(0, 160) + (post.caption.length > 160 ? '…' : '')}
            </p>
          )}

          {latestLog && (
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#888', flexWrap: 'wrap' }}>
              <MetricChip label="Reactions" value={latestLog.reactions} delta={delta(latestLog.reactions, day0?.reactions)} />
              <MetricChip label="Comments" value={latestLog.comments} delta={delta(latestLog.comments, day0?.comments)} />
              <MetricChip label="Reposts" value={latestLog.reposts} />
              <MetricChip label="Impressions" value={latestLog.impressions} delta={delta(latestLog.impressions, day0?.impressions)} />
              <span style={{ fontSize: 11, color: '#aaa' }}>Day {latestLog.day_marker}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button className="btn-ghost" onClick={onLogUpdate} style={{ fontSize: 12, padding: '5px 10px' }}>Log Update</button>
          <button className="btn-icon" onClick={onEdit}><Edit3 size={14} /></button>
          <button className="btn-icon" onClick={onDelete} style={{ color: '#DC2626' }}><Trash2 size={14} /></button>
          <button className="btn-icon" onClick={onToggle}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
        </div>
      </div>

      {/* Expanded: full embed + analytics */}
      {expanded && (
        <div style={{ marginTop: 20, borderTop: '1px solid #EAE6DE', paddingTop: 16 }}>
          {/* Full-size LinkedIn embed */}
          {embedUrl && (
            <div style={{ marginBottom: 20 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>LinkedIn Post</div>
              <iframe
                src={embedUrl}
                height={500}
                width="100%"
                frameBorder={0}
                allowFullScreen
                title="LinkedIn post full"
                style={{ borderRadius: 10, border: '1px solid #E0DBD3', display: 'block' }}
              />
            </div>
          )}

          {logs.length > 1 && (
            <>
              <div className="section-title" style={{ marginBottom: 8 }}>Analytics History</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="reactions" stroke="#F97316" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="impressions" stroke="#2563EB" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="comments" stroke="#16A34A" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 12, overflowX: 'auto' }}>
                <table className="arka-table">
                  <thead><tr><th>Day</th><th>Reactions</th><th>Comments</th><th>Reposts</th><th>Saves</th><th>Impressions</th></tr></thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}><td>Day {l.day_marker}</td><td>{l.reactions}</td><td>{l.comments}</td><td>{l.reposts}</td><td>{l.saves}</td><td>{(l.impressions || 0).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MetricChip({ label, value, delta }) {
  return (
    <span>
      <strong style={{ color: '#1A1A1A' }}>{value ?? 0}</strong>{' '}{label}
      {delta && (
        <span style={{ color: delta.startsWith('+') ? '#16A34A' : '#DC2626', marginLeft: 3, fontSize: 11 }}>{delta}</span>
      )}
    </span>
  )
}

function AddPostForm({ userId, initial, onSave, onCancel, logActivity }) {
  const [form, setForm] = useState({
    type: 'text',
    caption: '',
    tags: [],
    published_at: format(new Date(), 'yyyy-MM-dd'),
    image_url: '',
    slides: [],
    embed_code: '',  // raw input from user
    embed_url: '',   // parsed
    reactions: 0, comments: 0, reposts: 0, saves: 0, impressions: 0,
    ...initial,
    embed_code: initial?.embed_url || ''
  })
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')

  function f(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function handleEmbedCode(raw) {
    f('embed_code', raw)
    f('embed_url', parseLinkedInEmbed(raw))
  }

  async function handleSave() {
    setSaving(true)
    setUploadError('')

    const payload = {
      user_id: userId,
      type: form.type,
      caption: form.caption,
      tags: form.tags,
      published_at: form.published_at,
      image_url: form.image_url || null,
      slides: form.slides.length > 0 ? form.slides : null,
      embed_url: form.embed_url || null
    }

    let postId = initial?.id
    if (initial?.id) {
      const { error } = await supabase.from('posts').update(payload).eq('id', initial.id)
      if (error) { setUploadError(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('posts').insert(payload).select().single()
      if (error) { setUploadError(error.message); setSaving(false); return }
      postId = data?.id

      if (postId && (form.reactions || form.impressions || form.comments)) {
        await supabase.from('post_analytics_logs').insert({
          post_id: postId,
          user_id: userId,
          log_date: form.published_at,
          day_marker: 0,
          reactions: Number(form.reactions),
          comments: Number(form.comments),
          reposts: Number(form.reposts),
          saves: Number(form.saves),
          impressions: Number(form.impressions)
        })
      }

      logActivity?.({ type: 'post', action: 'Published', label: `Published: ${(form.caption || '').slice(0, 50)}` })
    }

    setSaving(false)
    onSave()
  }

  const embedParsed = parseLinkedInEmbed(form.embed_code)

  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Post Type</label>
          <select value={form.type} onChange={e => f('type', e.target.value)}>
            {POST_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Published Date</label>
          <input type="date" value={form.published_at} onChange={e => f('published_at', e.target.value)} />
        </div>
      </div>

      {/* LinkedIn Embed Code */}
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link size={11} /> LinkedIn Embed Code (optional)
        </label>
        <textarea
          value={form.embed_code}
          onChange={e => handleEmbedCode(e.target.value)}
          rows={2}
          placeholder={`Paste the <iframe> embed code from LinkedIn Share → Embed this post`}
          style={{ fontFamily: 'monospace', fontSize: 11 }}
        />
        {embedParsed && (
          <div style={{ marginTop: 8, padding: 8, background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 7, fontSize: 12, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6 }}>
            ✓ Valid LinkedIn embed detected — post preview will show in card
          </div>
        )}
        {form.embed_code && !embedParsed && (
          <div style={{ marginTop: 8, padding: 8, background: '#FEF3E8', border: '1px solid #FEE8D6', borderRadius: 7, fontSize: 12, color: '#C2590E' }}>
            Could not parse embed URL — paste the full &lt;iframe&gt; code from LinkedIn
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Caption</label>
        <textarea value={form.caption} onChange={e => f('caption', e.target.value)} rows={3} placeholder="What did you post?" />
      </div>

      {form.type === 'image' && !embedParsed && (
        <div className="form-group">
          <label>Image</label>
          {form.image_url && <img src={form.image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
          <FileUpload
            bucket="arka-media"
            path={`posts/${userId}/img-${Date.now()}`}
            onUpload={url => f('image_url', url)}
            accept="image/*"
            label="Upload Image"
          />
        </div>
      )}

      {form.type === 'carousel' && !embedParsed && (
        <div className="form-group">
          <label>Carousel Slides</label>
          <FileUpload
            bucket="arka-media"
            path={`posts/${userId}/carousel-${Date.now()}`}
            onUpload={urls => f('slides', Array.isArray(urls) ? urls.map((url, i) => ({ url, order: i })) : [{ url: urls, order: 0 }])}
            accept="image/*"
            multiple
            label="Upload Slides"
          />
          {form.slides.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {form.slides.map((s, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={s.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                  <span style={{ position: 'absolute', bottom: 2, right: 2, background: '#F97316', color: '#fff', fontSize: 9, borderRadius: 4, padding: '1px 4px' }}>{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="form-group">
        <label>Tags</label>
        <TagInput tags={form.tags} onChange={tags => f('tags', tags)} />
      </div>

      {!initial && (
        <>
          <div style={{ marginBottom: 10 }} className="section-title">Day 0 Metrics (optional)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {['reactions', 'comments', 'reposts', 'saves', 'impressions'].map(k => (
              <div className="form-group" key={k}>
                <label style={{ textTransform: 'capitalize' }}>{k}</label>
                <input type="number" value={form[k]} onChange={e => f(k, Number(e.target.value))} />
              </div>
            ))}
          </div>
        </>
      )}

      {uploadError && (
        <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: 7, fontSize: 13, marginBottom: 12 }}>
          {uploadError.includes('embed_url') || uploadError.includes('column')
            ? 'Run this SQL in Supabase first: ALTER TABLE posts ADD COLUMN IF NOT EXISTS embed_url text;'
            : uploadError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Log Post'}
        </button>
      </div>
    </>
  )
}

function LogUpdateForm({ post, onSave, onCancel }) {
  const publishDate = new Date(post.published_at)
  const dayMarkerAuto = differenceInDays(new Date(), publishDate)
  const closestMarker = DAY_MARKERS.reduce((prev, curr) =>
    Math.abs(curr - dayMarkerAuto) < Math.abs(prev - dayMarkerAuto) ? curr : prev
  )
  const [form, setForm] = useState({
    log_date: format(new Date(), 'yyyy-MM-dd'),
    day_marker: closestMarker,
    reactions: 0, comments: 0, reposts: 0, saves: 0, impressions: 0
  })
  const [saving, setSaving] = useState(false)
  function f(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    await supabase.from('post_analytics_logs').insert({
      post_id: post.id,
      user_id: post.user_id,
      log_date: form.log_date,
      day_marker: Number(form.day_marker),
      reactions: Number(form.reactions),
      comments: Number(form.comments),
      reposts: Number(form.reposts),
      saves: Number(form.saves),
      impressions: Number(form.impressions)
    })
    setSaving(false)
    onSave()
  }

  return (
    <>
      {post.embed_url && (
        <div style={{ marginBottom: 16 }}>
          <iframe
            src={post.embed_url}
            height={220}
            width="100%"
            frameBorder={0}
            allowFullScreen
            title="LinkedIn post"
            style={{ borderRadius: 8, border: '1px solid #E0DBD3', display: 'block' }}
          />
        </div>
      )}
      {!post.embed_url && post.caption && (
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          {post.caption.slice(0, 80)}{post.caption.length > 80 ? '…' : ''}
        </p>
      )}
      <div className="form-row">
        <div className="form-group">
          <label>Log Date</label>
          <input type="date" value={form.log_date} onChange={e => f('log_date', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Day Marker</label>
          <select value={form.day_marker} onChange={e => f('day_marker', e.target.value)}>
            {DAY_MARKERS.map(d => <option key={d} value={d}>Day {d}</option>)}
            {!DAY_MARKERS.includes(dayMarkerAuto) && (
              <option value={dayMarkerAuto}>Day {dayMarkerAuto} (today)</option>
            )}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {['reactions', 'comments', 'reposts', 'saves', 'impressions'].map(k => (
          <div className="form-group" key={k}>
            <label style={{ textTransform: 'capitalize' }}>{k}</label>
            <input type="number" value={form[k]} onChange={e => f(k, Number(e.target.value))} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Update'}</button>
      </div>
    </>
  )
}
