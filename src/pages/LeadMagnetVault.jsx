import React, { useEffect, useState } from 'react'
import { Plus, Grid, List, ExternalLink, Trash2, Edit3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useArka } from '../context/ArkaContext'
import Modal from '../components/Modal'
import TagInput from '../components/TagInput'
import FileUpload from '../components/FileUpload'

const TYPES = ['PDF', 'Checklist', 'Template', 'Video', 'Carousel', 'Other']

export default function LeadMagnetVault() {
  const { user, logActivity } = useArka()
  const [magnets, setMagnets] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid')
  const [showAdd, setShowAdd] = useState(false)
  const [editMagnet, setEditMagnet] = useState(null)
  const [previewMagnet, setPreviewMagnet] = useState(null)

  useEffect(() => { if (user) fetchMagnets() }, [user])

  async function fetchMagnets() {
    setLoading(true)
    const { data } = await supabase
      .from('lead_magnets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setMagnets(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this lead magnet?')) return
    await supabase.from('lead_magnets').delete().eq('id', id)
    fetchMagnets()
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Lead Magnet Vault</h1>
          <p className="page-subtitle">Every lead magnet is a 24/7 salesperson.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn-icon ${viewMode==='grid'?'active':''}`} onClick={() => setViewMode('grid')} style={{ background: viewMode==='grid'?'var(--arka-orange-light)':undefined }}><Grid size={16} /></button>
          <button className={`btn-icon ${viewMode==='list'?'active':''}`} onClick={() => setViewMode('list')} style={{ background: viewMode==='list'?'var(--arka-orange-light)':undefined }}><List size={16} /></button>
          <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Magnet
          </button>
        </div>
      </div>

      {loading ? (
        <div className={viewMode === 'grid' ? 'grid-3' : 'flex'}>
          {[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 12 }} />)}
        </div>
      ) : magnets.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>🧲</div>
          <div className="empty-state-title">No Lead Magnets Yet</div>
          <div className="empty-state-text">Every lead magnet is a 24/7 salesperson. Add your first one.</div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid-3">
          {magnets.map(m => (
            <MagnetCard
              key={m.id}
              magnet={m}
              onPreview={() => setPreviewMagnet(m)}
              onEdit={() => setEditMagnet(m)}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="arka-table">
            <thead>
              <tr><th>Title</th><th>Type</th><th>Description</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {magnets.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.title}</td>
                  <td><span className="badge badge-orange">{m.type}</span></td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</td>
                  <td style={{ color: 'var(--arka-gray)', fontSize: 12 }}>{m.created_at?.slice(0,10)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => setPreviewMagnet(m)}><ExternalLink size={13} /></button>
                      <button className="btn-icon" onClick={() => setEditMagnet(m)}><Edit3 size={13} /></button>
                      <button className="btn-icon" onClick={() => handleDelete(m.id)} style={{ color: 'var(--arka-red)' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd || !!editMagnet} onClose={() => { setShowAdd(false); setEditMagnet(null) }} title={editMagnet ? 'Edit Lead Magnet' : 'Add Lead Magnet'} maxWidth={560}>
        <MagnetForm
          userId={user?.id}
          initial={editMagnet}
          onSave={async () => { setShowAdd(false); setEditMagnet(null); fetchMagnets() }}
          onCancel={() => { setShowAdd(false); setEditMagnet(null) }}
          logActivity={logActivity}
        />
      </Modal>

      <Modal open={!!previewMagnet} onClose={() => setPreviewMagnet(null)} title="Lead Magnet Preview" maxWidth={500}>
        {previewMagnet && <MagnetPreview magnet={previewMagnet} />}
      </Modal>
    </div>
  )
}

function MagnetCard({ magnet, onPreview, onEdit, onDelete }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {magnet.cover_url ? (
        <img src={magnet.cover_url} alt={magnet.title} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: 140, background: 'var(--arka-orange-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--arka-orange)', opacity: 0.5 }}>
            {magnet.type?.[0] || '?'}
          </span>
        </div>
      )}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className="badge badge-orange">{magnet.type}</span>
          <span style={{ fontSize: 11, color: 'var(--arka-gray)', marginLeft: 'auto' }}>{magnet.created_at?.slice(0,10)}</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{magnet.title}</div>
        {magnet.description && (
          <p style={{ fontSize: 12, color: 'var(--arka-gray)', lineHeight: 1.4, marginBottom: 12 }}>
            {magnet.description.slice(0, 80)}{magnet.description.length > 80 ? '…' : ''}
          </p>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-ghost" style={{ fontSize: 12, flex: 1, padding: '6px 10px', textAlign: 'center' }} onClick={onPreview}>Preview</button>
          <button className="btn-icon" onClick={onEdit}><Edit3 size={13} /></button>
          <button className="btn-icon" onClick={onDelete} style={{ color: 'var(--arka-red)' }}><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}

function MagnetPreview({ magnet }) {
  return (
    <div>
      {magnet.cover_url && <img src={magnet.cover_url} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="badge badge-orange">{magnet.type}</span>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{magnet.title}</h3>
      {magnet.description && <p style={{ fontSize: 13, color: 'var(--arka-gray)', lineHeight: 1.6, marginBottom: 16 }}>{magnet.description}</p>}
      {magnet.performance_notes && (
        <div className="callout" style={{ marginBottom: 16, fontSize: 13 }}>
          <strong>Performance Notes:</strong> {magnet.performance_notes}
        </div>
      )}
      {(magnet.tags || []).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {magnet.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        {magnet.file_url && (
          <a href={magnet.file_url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, fontSize: 13 }}>
            <ExternalLink size={14} /> Download File
          </a>
        )}
        {magnet.external_url && (
          <a href={magnet.external_url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, fontSize: 13 }}>
            <ExternalLink size={14} /> Open Link
          </a>
        )}
      </div>
    </div>
  )
}

function MagnetForm({ userId, initial, onSave, onCancel, logActivity }) {
  const [form, setForm] = useState({ title:'',type:'PDF',description:'',file_url:'',external_url:'',cover_url:'',tags:[],performance_notes:'',...initial })
  const [saving, setSaving] = useState(false)
  function f(k,v){setForm(p=>({...p,[k]:v}))}

  async function handleSave() {
    setSaving(true)
    const payload = { user_id: userId, ...form }
    if (initial?.id) {
      await supabase.from('lead_magnets').update(payload).eq('id', initial.id)
    } else {
      const { data } = await supabase.from('lead_magnets').insert(payload).select().single()
      logActivity?.({ type: 'lead_magnet', action: 'Lead Magnet Added', label: form.title, ref_id: data?.id })
    }
    setSaving(false)
    onSave()
  }

  return (
    <>
      <div className="form-row">
        <div className="form-group"><label>Title *</label><input value={form.title} onChange={e=>f('title',e.target.value)} placeholder="Ultimate LinkedIn Checklist" /></div>
        <div className="form-group"><label>Type</label><select value={form.type} onChange={e=>f('type',e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div className="form-group"><label>Description</label><textarea value={form.description||''} onChange={e=>f('description',e.target.value)} rows={3} /></div>
      <div className="form-group">
        <label>Cover Image</label>
        {form.cover_url && <img src={form.cover_url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
        <FileUpload bucket="arka-media" path={`lead-magnets/${userId}/cover-${Date.now()}`} onUpload={url=>f('cover_url',url)} accept="image/*" label="Upload Cover" />
      </div>
      <div className="form-group">
        <label>File Upload (or External URL)</label>
        {!form.external_url && (
          <FileUpload bucket="arka-media" path={`lead-magnets/${userId}/file-${Date.now()}`} onUpload={url=>f('file_url',url)} accept="*/*" label="Upload File" />
        )}
        <input value={form.external_url||''} onChange={e=>f('external_url',e.target.value)} placeholder="Or paste external URL" style={{ marginTop: 8 }} />
      </div>
      <div className="form-group"><label>Tags</label><TagInput tags={form.tags||[]} onChange={tags=>f('tags',tags)} /></div>
      <div className="form-group"><label>Performance Notes</label><textarea value={form.performance_notes||''} onChange={e=>f('performance_notes',e.target.value)} rows={2} placeholder="How is this performing?" /></div>
      <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':initial?.id?'Save Changes':'Add Magnet'}</button>
      </div>
    </>
  )
}
