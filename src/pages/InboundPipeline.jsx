import React, { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useArka } from '../context/ArkaContext'
import Modal from '../components/Modal'
import TagInput from '../components/TagInput'
import DueDateBadge from '../components/DueDateBadge'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STAGES = ['New Inquiry', 'Qualifying', 'Discovery Call Booked', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost']
const SOURCES = ['LinkedIn Post', 'DM', 'Referral', 'Website', 'Other']
const PRIORITY_COLORS = { High: 'var(--arka-orange)', Medium: 'var(--arka-blue)', Low: 'var(--arka-gray)', Urgent: 'var(--arka-red)' }

export default function InboundPipeline() {
  const { user, logActivity, settings } = useArka()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [addStage, setAddStage] = useState('New Inquiry')
  const er = settings?.exchange_rate || 278

  useEffect(() => { if (user) fetchLeads() }, [user])

  async function fetchLeads() {
    setLoading(true)
    const { data } = await supabase
      .from('inbound_leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  async function handleMove(leadId, newStage) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage === newStage) return

    const stageHistory = [...(lead.stage_history || []), { stage: newStage, changed_at: new Date().toISOString() }]
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage, stage_history: stageHistory } : l))

    await supabase.from('inbound_leads').update({
      stage: newStage, stage_history: stageHistory, updated_at: new Date().toISOString()
    }).eq('id', leadId)

    const actionLabel = newStage === 'Closed Won' ? 'Won' : newStage === 'Closed Lost' ? 'Lost' : 'They Replied'
    logActivity({ type: 'inbound', action: actionLabel, label: `${actionLabel} - ${lead.lead_name}`, ref_id: leadId })
  }

  async function handleDelete(id) {
    if (!confirm('Delete this lead?')) return
    await supabase.from('inbound_leads').delete().eq('id', id)
    setSelectedLead(null)
    fetchLeads()
  }

  const active = leads.filter(l => !['Closed Won','Closed Lost'].includes(l.stage))
  const totalValue = active.reduce((s,l) => s+(l.deal_value||0), 0)
  const won = leads.filter(l => l.stage === 'Closed Won')
  const total = leads.filter(l => ['Closed Won','Closed Lost'].includes(l.stage)).length
  const convRate = total > 0 ? Math.round((won.length/total)*100) : 0

  const avgClose = (() => {
    const closed = leads.filter(l => l.stage === 'Closed Won' && (l.stage_history||[]).length > 1)
    if (!closed.length) return 0
    const diffs = closed.map(l => {
      const h = l.stage_history
      return differenceInDays(new Date(h[h.length-1].changed_at), new Date(h[0].changed_at))
    })
    return Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length)
  })()

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Inbound Pipeline</h1>
          <p className="page-subtitle">Track leads that come to you</p>
        </div>
        <button className="btn-primary" onClick={() => { setAddStage('New Inquiry'); setShowAdd(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Lead
        </button>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <SummaryCard label="Total Inbound Value" value={`$${totalValue.toLocaleString()}`} sub={`PKR ${(totalValue*er).toLocaleString()}`} color="blue" />
        <SummaryCard label="Active Leads" value={active.length} color="blue" />
        <SummaryCard label="Avg Close Time" value={`${avgClose}d`} color="gray" />
        <SummaryCard label="Conversion Rate" value={`${convRate}%`} color="green" />
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 16 }}>{[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{width:220,height:300,borderRadius:12}} />)}</div>
      ) : (
        <InboundKanban
          leads={leads}
          stages={STAGES}
          onMove={handleMove}
          onCardClick={l => setSelectedLead(l)}
          onAddCard={stage => { setAddStage(stage); setShowAdd(true) }}
          er={er}
        />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Inbound Lead" maxWidth={540}>
        <LeadForm userId={user?.id} initialStage={addStage} onSave={() => { setShowAdd(false); fetchLeads() }} onCancel={() => setShowAdd(false)} logActivity={logActivity} />
      </Modal>

      <Modal open={!!selectedLead} onClose={() => setSelectedLead(null)} title="Lead Detail" maxWidth={600}>
        {selectedLead && (
          <LeadDetail
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onMove={async (id, stage) => { await handleMove(id, stage); const {data} = await supabase.from('inbound_leads').select('*').eq('id',id).single(); setSelectedLead(data) }}
            onDelete={handleDelete}
            onSave={() => { setSelectedLead(null); fetchLeads() }}
            er={er}
          />
        )}
      </Modal>
    </div>
  )
}

function SummaryCard({ label, value, sub, color }) {
  const colorMap = { blue: 'var(--arka-blue)', orange: 'var(--arka-orange)', green: 'var(--arka-green)', gray: 'var(--arka-black)' }
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="display-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: colorMap[color] }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--arka-gray)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function InboundKanban({ leads, stages, onMove, onCardClick, onAddCard, er }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const overIsStage = stages.includes(over.id)
    if (overIsStage) {
      onMove(active.id, over.id)
    } else {
      const overLead = leads.find(l => l.id === over.id)
      if (overLead) onMove(active.id, overLead.stage)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {stages.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage)
          const stageValue = stageLeads.reduce((s,l) => s+(l.deal_value||0), 0)
          return (
            <KanbanStageColumn key={stage} stage={stage} stages={stages} leads={stageLeads} stageValue={stageValue} onCardClick={onCardClick} onMove={onMove} onAddCard={onAddCard} er={er} />
          )
        })}
      </div>
    </DndContext>
  )
}

function SortableLeadCard({ lead, onCardClick, onMove, stages }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }
  const priorityBorderColor = PRIORITY_COLORS[lead.priority] || 'var(--arka-gray-light)'
  const colIndex = stages.indexOf(lead.stage)
  const daysInStage = (() => {
    const hist = lead.stage_history || []
    const entry = hist.filter(h=>h.stage===lead.stage).pop()
    if (!entry) return 0
    return differenceInDays(new Date(), new Date(entry.changed_at))
  })()

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`kanban-card ${lead.stage === 'Closed Won' ? 'stage-won' : lead.stage === 'Closed Lost' ? 'stage-lost' : ''}`}
        style={{ borderLeft: `3px solid ${priorityBorderColor}` }}
      >
        <div {...attributes} {...listeners} style={{ cursor: 'grab' }} onClick={() => onCardClick(lead)}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{lead.lead_name}</div>
          {lead.company && <div style={{ fontSize: 11, color: 'var(--arka-gray)', marginBottom: 6 }}>{lead.company}</div>}
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--arka-blue)', marginBottom: 6 }}>
            ${(lead.deal_value || 0).toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {lead.source && <span className="badge badge-blue" style={{ fontSize: 10 }}>{lead.source}</span>}
          </div>
          <div style={{ fontSize: 10, color: 'var(--arka-gray)', marginTop: 6 }}>{daysInStage}d in stage</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, marginTop: 8, borderTop: '1px solid var(--arka-gray-light)', paddingTop: 6 }}>
          {colIndex > 0 && (
            <button className="btn-icon" title={stages[colIndex - 1]}
              onClick={e => { e.stopPropagation(); onMove(lead.id, stages[colIndex - 1]) }}
              style={{ color: 'var(--arka-gray)', padding: '3px' }}>
              <ChevronLeft size={14} />
            </button>
          )}
          {colIndex < stages.length - 1 && (
            <button className="btn-icon" title={stages[colIndex + 1]}
              onClick={e => { e.stopPropagation(); onMove(lead.id, stages[colIndex + 1]) }}
              style={{ color: 'var(--arka-blue)', padding: '3px' }}>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function KanbanStageColumn({ stage, stages, leads, stageValue, onCardClick, onMove, onAddCard, er }) {
  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <span className="kanban-column-title">{stage}</span>
        <span className="kanban-column-count">{leads.length}</span>
      </div>
      {stageValue > 0 && (
        <div style={{ fontSize: 11, color: 'var(--arka-blue)', fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>
          ${stageValue.toLocaleString()}
        </div>
      )}
      <SortableContext items={leads.map(l=>l.id)} strategy={verticalListSortingStrategy}>
        <div className="kanban-cards">
          {leads.map(l => <SortableLeadCard key={l.id} lead={l} stages={stages} onCardClick={onCardClick} onMove={onMove} />)}
        </div>
      </SortableContext>
      <button className="kanban-add-btn" onClick={() => onAddCard(stage)}><Plus size={14} /> Add</button>
    </div>
  )
}

function LeadDetail({ lead, onClose, onMove, onDelete, onSave, er }) {
  const [editing, setEditing] = useState(false)
  const daysInPipeline = differenceInDays(new Date(), new Date(lead.created_at))
  if (editing) return <LeadForm userId={lead.user_id} initial={lead} onSave={onSave} onCancel={() => setEditing(false)} logActivity={()=>{}} />
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{lead.lead_name}</h3>
          {lead.company && <p style={{ color: 'var(--arka-gray)', fontSize: 13 }}>{lead.company}</p>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--arka-blue)' }}>${(lead.deal_value||0).toLocaleString()}</div>
      </div>
      <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
        {[['Stage',<span className="badge badge-blue">{lead.stage}</span>],['Source',lead.source],['How They Found You',lead.source],['Content Piece',lead.content_source],['Priority',lead.priority],['Days in Pipeline',`${daysInPipeline}d`],['PKR Value',`PKR ${Math.round((lead.deal_value||0)*er).toLocaleString()}`]].map(([label,value],i) => (
          <div key={i}><div style={{ fontSize: 11, color: 'var(--arka-gray)', marginBottom: 2, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{value||'—'}</div></div>
        ))}
      </div>
      {lead.notes && <div className="callout" style={{ marginBottom: 16, fontSize: 13 }}>{lead.notes}</div>}
      {(lead.stage_history||[]).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Stage History</div>
          {lead.stage_history.map((h,i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--arka-gray)', marginBottom: 4, alignItems: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--arka-blue)', flexShrink: 0 }} />
              <span style={{ fontWeight: 500, color: 'var(--arka-black)' }}>{h.stage}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginBottom: 6, display: 'block' }}>Move to Stage</label>
        <select value={lead.stage} onChange={e => onMove(lead.id, e.target.value)} style={{ width: '100%' }}>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn-primary" onClick={() => onMove(lead.id, 'Closed Won')}>Mark Won</button>
        <button className="btn-secondary" onClick={() => onMove(lead.id, 'Closed Lost')} style={{ color: 'var(--arka-red)' }}>Mark Lost</button>
        <button className="btn-icon" onClick={() => onDelete(lead.id)} style={{ color: 'var(--arka-red)', marginLeft: 'auto' }}><Trash2 size={16} /></button>
      </div>
    </div>
  )
}

function LeadForm({ userId, initial, initialStage, onSave, onCancel, logActivity }) {
  const [form, setForm] = useState({ lead_name:'',company:'',deal_value:'',stage:initialStage||'New Inquiry',source:'LinkedIn Post',priority:'Medium',content_source:'',tags:[],notes:'',...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function f(k,v){setForm(p=>({...p,[k]:v}))}
  async function handleSave(){
    if (!form.lead_name.trim()) { setError('Lead name is required'); return }
    setSaving(true)
    setError('')
    const payload = {
      user_id: userId,
      lead_name: form.lead_name,
      company: form.company || null,
      deal_value: Number(form.deal_value) || 0,
      stage: form.stage,
      source: form.source,
      priority: form.priority,
      content_source: form.content_source || null,
      tags: form.tags || [],
      notes: form.notes || null,
      updated_at: new Date().toISOString()
    }
    if(!initial){
      payload.stage_history=[{stage:form.stage,changed_at:new Date().toISOString()}]
      const {data, error: err}=await supabase.from('inbound_leads').insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      logActivity?.({type:'inbound',action:'New Inquiry',label:`New Inquiry - ${form.lead_name}`,ref_id:data?.id})
    }else{
      const {error: err}=await supabase.from('inbound_leads').update(payload).eq('id',initial.id)
      if (err) { setError(err.message); setSaving(false); return }
    }
    setSaving(false);onSave()
  }
  return (
    <>
      <div className="form-row">
        <div className="form-group"><label>Lead Name *</label><input value={form.lead_name} onChange={e=>f('lead_name',e.target.value)} /></div>
        <div className="form-group"><label>Company</label><input value={form.company} onChange={e=>f('company',e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Deal Value ($)</label><input type="number" value={form.deal_value} onChange={e=>f('deal_value',e.target.value)} /></div>
        <div className="form-group"><label>Stage</label><select value={form.stage} onChange={e=>f('stage',e.target.value)}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Source</label><select value={form.source} onChange={e=>f('source',e.target.value)}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select></div>
        <div className="form-group"><label>Priority</label><select value={form.priority} onChange={e=>f('priority',e.target.value)}><option>Urgent</option><option>High</option><option>Medium</option><option>Low</option></select></div>
      </div>
      <div className="form-group"><label>Which content brought them?</label><input value={form.content_source||''} onChange={e=>f('content_source',e.target.value)} placeholder="Post title or link" /></div>
      <div className="form-group"><label>Tags</label><TagInput tags={form.tags||[]} onChange={tags=>f('tags',tags)} /></div>
      <div className="form-group"><label>Notes</label><textarea value={form.notes||''} onChange={e=>f('notes',e.target.value)} rows={3} /></div>
      {error && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '10px 14px', borderRadius: 7, fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':initial?'Save Changes':'Add Lead'}</button>
      </div>
    </>
  )
}
