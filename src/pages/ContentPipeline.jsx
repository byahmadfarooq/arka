import React, { useEffect, useState } from 'react'
import { Plus, Link } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useArka } from '../context/ArkaContext'
import Modal from '../components/Modal'
import TagInput from '../components/TagInput'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function parseLinkedInEmbed(raw) {
  if (!raw || !raw.trim()) return ''
  const trimmed = raw.trim()
  if (trimmed.startsWith('https://www.linkedin.com/embed/')) return trimmed
  const match = trimmed.match(/src=["']([^"']+)["']/)
  if (match) return match[1]
  return ''
}

const STAGES = ['Ideas', 'Drafting', 'Ready', 'Scheduled', 'Published']
const FORMATS = ['Text', 'Image', 'Carousel']
const FORMAT_COLORS = { Text: 'gray', Image: 'blue', Carousel: 'orange' }

export default function ContentPipeline() {
  const { user, logActivity } = useArka()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [addStage, setAddStage] = useState('Ideas')
  const hasSynced = React.useRef(false)

  useEffect(() => { if (user) fetchItems() }, [user])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('content_pipeline')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    const fetched = data || []
    setItems(fetched)
    setLoading(false)

    // Only sync once per session to avoid duplicates
    if (!hasSynced.current) {
      hasSynced.current = true
      await syncPublished(fetched)
    }
  }

  async function syncPublished(fetched) {
    const published = fetched.filter(i => i.status === 'Published')
    if (published.length === 0) return

    // Fetch existing posts to deduplicate by caption
    const { data: existingPosts } = await supabase
      .from('posts').select('id, caption').eq('user_id', user.id)
    const existingCaptions = new Set(existingPosts?.map(p => p.caption) || [])

    for (const item of published) {
      const caption = item.body || item.title
      // Skip if already synced (post_id exists) or post with same caption exists
      if (item.post_id || existingCaptions.has(caption)) continue

      const { data: post } = await supabase.from('posts').insert({
        user_id: user.id,
        type: (item.format || 'text').toLowerCase(),
        caption,
        published_at: item.scheduled_date || new Date().toISOString().slice(0, 10),
        tags: item.tags || [],
        embed_url: item.embed_url || null
      }).select().single()

      if (post?.id) {
        await supabase.from('content_pipeline').update({ post_id: post.id }).eq('id', item.id)
        existingCaptions.add(caption)
      }
    }
  }

  async function handleMove(itemId, newStage) {
    const item = items.find(i => i.id === itemId)
    if (!item || item.status === newStage) return
    await supabase.from('content_pipeline').update({ status: newStage }).eq('id', itemId)

    if (newStage === 'Published' && !item.post_id) {
      const { data: post } = await supabase.from('posts').insert({
        user_id: user.id,
        type: (item.format || 'text').toLowerCase(),
        caption: item.body || item.title,
        published_at: item.scheduled_date || new Date().toISOString().slice(0, 10),
        tags: item.tags || [],
        embed_url: item.embed_url || null
      }).select().single()
      if (post?.id) {
        await supabase.from('content_pipeline').update({ post_id: post.id }).eq('id', itemId)
      }
      logActivity({ type: 'post', action: 'Published', label: `Published: ${(item.title || '').slice(0, 50)}` })
    }
    fetchItems()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this content item?')) return
    await supabase.from('content_pipeline').delete().eq('id', id)
    fetchItems()
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Content Pipeline</h1>
          <p className="page-subtitle">From idea to published</p>
        </div>
        <button className="btn-primary" onClick={() => { setAddStage('Ideas'); setShowAdd(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Content
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 16 }}>{[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{width:200,height:300,borderRadius:12}} />)}</div>
      ) : (
        <ContentKanban
          items={items}
          stages={STAGES}
          onMove={handleMove}
          onEdit={item => setEditItem(item)}
          onDelete={handleDelete}
          onAddCard={stage => { setAddStage(stage); setShowAdd(true) }}
        />
      )}

      <Modal open={showAdd || !!editItem} onClose={() => { setShowAdd(false); setEditItem(null) }} title={editItem ? 'Edit Content' : 'Add Content'} maxWidth={560}>
        <ContentForm
          userId={user?.id}
          initial={editItem || { status: addStage }}
          onSave={() => { setShowAdd(false); setEditItem(null); fetchItems() }}
          onCancel={() => { setShowAdd(false); setEditItem(null) }}
        />
      </Modal>
    </div>
  )
}

function ContentKanban({ items, stages, onMove, onEdit, onDelete, onAddCard }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const overIsStage = stages.includes(over.id)
    if (overIsStage) {
      onMove(active.id, over.id)
    } else {
      const overItem = items.find(i => i.id === over.id)
      if (overItem) onMove(active.id, overItem.status)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {stages.map(stage => {
          const stageItems = items.filter(i => i.status === stage)
          return (
            <ContentColumn key={stage} stage={stage} items={stageItems} onEdit={onEdit} onDelete={onDelete} onAddCard={onAddCard} />
          )
        })}
      </div>
    </DndContext>
  )
}

function SortableContentCard({ item, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div className="kanban-card" onClick={() => onEdit(item)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className={`badge badge-${FORMAT_COLORS[item.format] || 'gray'}`} style={{ fontSize: 10 }}>{item.format}</span>
          {item.embed_url && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#0077B5', fontWeight: 500 }}><Link size={9} /> Embed</span>}
          {item.scheduled_date && <span style={{ fontSize: 10, color: 'var(--arka-gray)' }}>{item.scheduled_date}</span>}
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, lineHeight: 1.3 }}>{item.title}</div>
        {item.embed_url && (
          <div style={{ marginBottom: 8, borderRadius: 7, overflow: 'hidden', border: '1px solid #E0DBD3' }}>
            <iframe
              src={item.embed_url}
              height={160}
              width="100%"
              frameBorder={0}
              allowFullScreen
              title="LinkedIn post"
              style={{ display: 'block', pointerEvents: 'none' }}
            />
          </div>
        )}
        {!item.embed_url && item.body && (
          <p style={{ fontSize: 11, color: 'var(--arka-gray)', lineHeight: 1.4, marginBottom: 6 }}>
            {item.body.slice(0, 100)}{item.body.length > 100 ? '…' : ''}
          </p>
        )}
        {(item.tags || []).length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {item.tags.slice(0, 3).map(t => <span key={t} className="tag-pill">{t}</span>)}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-icon"
            style={{ color: 'var(--arka-red)', padding: '4px' }}
            onClick={e => { e.stopPropagation(); onDelete(item.id) }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

function ContentColumn({ stage, items, onEdit, onDelete, onAddCard }) {
  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <span className="kanban-column-title">{stage}</span>
        <span className="kanban-column-count">{items.length}</span>
      </div>
      <SortableContext items={items.map(i=>i.id)} strategy={verticalListSortingStrategy}>
        <div className="kanban-cards">
          {items.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--arka-gray)', textAlign: 'center', padding: '16px 0', opacity: 0.5 }}>Empty</div>
          )}
          {items.map(item => (
            <SortableContentCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
      <button className="kanban-add-btn" onClick={() => onAddCard(stage)}><Plus size={14} /> Add</button>
    </div>
  )
}

function ContentForm({ userId, initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: '', format: 'Text', status: 'Ideas', body: '', tags: [], scheduled_date: '', notes: '',
    embed_code: '', embed_url: '',
    ...initial,
    embed_code: initial?.embed_url || ''
  })
  const [saving, setSaving] = useState(false)
  function f(k,v){setForm(p=>({...p,[k]:v}))}

  function handleEmbedCode(raw) {
    f('embed_code', raw)
    f('embed_url', parseLinkedInEmbed(raw))
  }

  async function handleSave() {
    setSaving(true)
    const { embed_code, ...rest } = form
    const payload = { user_id: userId, ...rest }
    if (initial?.id) {
      await supabase.from('content_pipeline').update(payload).eq('id', initial.id)
    } else {
      await supabase.from('content_pipeline').insert(payload)
    }
    setSaving(false)
    onSave()
  }

  const embedParsed = parseLinkedInEmbed(form.embed_code)

  return (
    <>
      <div className="form-group"><label>Title / Hook Line *</label><input value={form.title} onChange={e=>f('title',e.target.value)} placeholder="5 things killing your LinkedIn reach" /></div>
      <div className="form-row">
        <div className="form-group"><label>Format</label><select value={form.format} onChange={e=>f('format',e.target.value)}>{FORMATS.map(f=><option key={f}>{f}</option>)}</select></div>
        <div className="form-group"><label>Status</label><select value={form.status} onChange={e=>f('status',e.target.value)}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
      </div>

      {/* LinkedIn Embed */}
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
          <>
            <div style={{ marginTop: 8, padding: 8, background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 7, fontSize: 12, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6 }}>
              ✓ Valid LinkedIn embed detected
            </div>
            <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: '1px solid #E0DBD3' }}>
              <iframe
                src={embedParsed}
                height={400}
                width="100%"
                frameBorder={0}
                allowFullScreen
                title="LinkedIn post preview"
                style={{ display: 'block' }}
              />
            </div>
          </>
        )}
        {form.embed_code && !embedParsed && (
          <div style={{ marginTop: 8, padding: 8, background: '#FEF3E8', border: '1px solid #FEE8D6', borderRadius: 7, fontSize: 12, color: '#C2590E' }}>
            Could not parse embed URL — paste the full &lt;iframe&gt; code from LinkedIn
          </div>
        )}
      </div>

      <div className="form-group"><label>Body / Draft Notes</label><textarea value={form.body||''} onChange={e=>f('body',e.target.value)} rows={4} placeholder="Write your draft here…" /></div>
      <div className="form-group"><label>Scheduled Date</label><input type="date" value={form.scheduled_date||''} onChange={e=>f('scheduled_date',e.target.value)} /></div>
      <div className="form-group"><label>Tags</label><TagInput tags={form.tags||[]} onChange={tags=>f('tags',tags)} /></div>
      <div className="form-group"><label>Notes</label><textarea value={form.notes||''} onChange={e=>f('notes',e.target.value)} rows={2} /></div>
      <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':initial?.id?'Save Changes':'Add Content'}</button>
      </div>
    </>
  )
}
