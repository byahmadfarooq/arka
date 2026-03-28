import React, { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
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

const STAGES = [
  'Prospecting', 'Outreach Sent', 'In Conversation',
  'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'
]

const PRIORITY_COLORS = { High: 'var(--arka-orange)', Medium: 'var(--arka-blue)', Low: 'var(--arka-gray)', Urgent: 'var(--arka-red)' }

export default function OutboundPipeline() {
  const { user, logActivity, settings } = useArka()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [addStage, setAddStage] = useState('Prospecting')
  const er = settings?.exchange_rate || 278

  useEffect(() => { if (user) fetchDeals() }, [user])

  async function fetchDeals() {
    setLoading(true)
    const { data } = await supabase
      .from('outbound_deals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setDeals(data || [])
    setLoading(false)
  }

  async function handleMove(dealId, newStage) {
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage === newStage) return

    const stageHistory = [...(deal.stage_history || []), { stage: newStage, changed_at: new Date().toISOString() }]

    await supabase.from('outbound_deals').update({
      stage: newStage,
      stage_history: stageHistory,
      updated_at: new Date().toISOString()
    }).eq('id', dealId)

    const actionLabel = newStage === 'Outreach Sent' ? 'DM Sent'
      : newStage === 'Closed Won' ? 'Won'
      : newStage === 'Closed Lost' ? 'Lost'
      : 'Stage Changed'

    logActivity({ type: 'outbound', action: actionLabel, label: `${actionLabel} - ${deal.lead_name}`, ref_id: dealId })
    fetchDeals()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this deal?')) return
    await supabase.from('outbound_deals').delete().eq('id', id)
    setSelectedDeal(null)
    fetchDeals()
  }

  // Summary stats
  const totalPipeline = deals.filter(d => !['Closed Won','Closed Lost'].includes(d.stage)).reduce((s,d) => s+(d.deal_value||0),0)
  const inProgress = deals.filter(d => !['Closed Won','Closed Lost'].includes(d.stage)).length
  const won = deals.filter(d => d.stage === 'Closed Won')
  const total = deals.filter(d => ['Closed Won','Closed Lost'].includes(d.stage)).length
  const winRate = total > 0 ? Math.round((won.length / total) * 100) : 0

  const avgClose = (() => {
    const closed = deals.filter(d => d.stage === 'Closed Won' && d.stage_history?.length > 1)
    if (!closed.length) return 0
    const diffs = closed.map(d => {
      const first = d.stage_history[0]?.changed_at
      const last = d.stage_history[d.stage_history.length - 1]?.changed_at
      return differenceInDays(new Date(last), new Date(first))
    })
    return Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length)
  })()

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Outbound Pipeline</h1>
          <p className="page-subtitle">Track every outbound deal from prospect to close</p>
        </div>
        <button className="btn-primary" onClick={() => { setAddStage('Prospecting'); setShowAdd(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Deal
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <SummaryCard label="Pipeline Value" value={`$${totalPipeline.toLocaleString()}`} sub={`PKR ${(totalPipeline*er).toLocaleString()}`} color="orange" />
        <SummaryCard label="Deals in Progress" value={inProgress} color="blue" />
        <SummaryCard label="Avg Close Time" value={`${avgClose}d`} color="gray" />
        <SummaryCard label="Win Rate" value={`${winRate}%`} color="green" />
      </div>

      {/* Kanban */}
      {loading ? (
        <div style={{ display: 'flex', gap: 16 }}>{[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{width:220,height:300,borderRadius:12}} />)}</div>
      ) : (
        <OutboundKanban
          deals={deals}
          stages={STAGES}
          onMove={handleMove}
          onCardClick={d => setSelectedDeal(d)}
          onAddCard={stage => { setAddStage(stage); setShowAdd(true) }}
          er={er}
        />
      )}

      {/* Add Deal Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Deal" maxWidth={540}>
        <DealForm
          userId={user?.id}
          initialStage={addStage}
          onSave={() => { setShowAdd(false); fetchDeals() }}
          onCancel={() => setShowAdd(false)}
          logActivity={logActivity}
        />
      </Modal>

      {/* Deal Detail Modal */}
      <Modal open={!!selectedDeal} onClose={() => setSelectedDeal(null)} title="Deal Detail" maxWidth={600}>
        {selectedDeal && (
          <DealDetail
            deal={selectedDeal}
            onClose={() => setSelectedDeal(null)}
            onMove={async (id, stage) => { await handleMove(id, stage); const {data} = await supabase.from('outbound_deals').select('*').eq('id',id).single(); setSelectedDeal(data) }}
            onDelete={handleDelete}
            onSave={() => { setSelectedDeal(null); fetchDeals() }}
            er={er}
          />
        )}
      </Modal>
    </div>
  )
}

function SummaryCard({ label, value, sub, color }) {
  const colorMap = { orange: 'var(--arka-orange)', blue: 'var(--arka-blue)', green: 'var(--arka-green)', gray: 'var(--arka-black)' }
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="display-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: colorMap[color] }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--arka-gray)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function OutboundKanban({ deals, stages, onMove, onCardClick, onAddCard, er }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const overIsStage = stages.includes(over.id)
    if (overIsStage) {
      onMove(active.id, over.id)
    } else {
      const overDeal = deals.find(d => d.id === over.id)
      if (overDeal) onMove(active.id, overDeal.stage)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage)
          const stageValue = stageDeals.reduce((s,d) => s+(d.deal_value||0), 0)
          return (
            <KanbanStageColumn
              key={stage}
              stage={stage}
              deals={stageDeals}
              stageValue={stageValue}
              onCardClick={onCardClick}
              onAddCard={onAddCard}
              er={er}
            />
          )
        })}
      </div>
    </DndContext>
  )
}

function SortableDealCard({ deal, onCardClick, er }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const priorityBorderColor = PRIORITY_COLORS[deal.priority] || 'var(--arka-gray-light)'
  const isWon = deal.stage === 'Closed Won'
  const isLost = deal.stage === 'Closed Lost'
  const daysInStage = (() => {
    const hist = deal.stage_history || []
    const entry = hist.findLast ? hist.findLast(h => h.stage === deal.stage) : hist.filter(h=>h.stage===deal.stage).pop()
    if (!entry) return 0
    return differenceInDays(new Date(), new Date(entry.changed_at))
  })()

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className={`kanban-card ${isWon ? 'stage-won' : isLost ? 'stage-lost' : ''}`}
        style={{ borderLeft: `3px solid ${priorityBorderColor}` }}
        onClick={() => onCardClick(deal)}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{deal.lead_name}</div>
        {deal.company && <div style={{ fontSize: 11, color: 'var(--arka-gray)', marginBottom: 6 }}>{deal.company}</div>}
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--arka-orange)', marginBottom: 6 }}>
          ${(deal.deal_value || 0).toLocaleString()}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {deal.source && <span className="badge badge-gray" style={{ fontSize: 10 }}>{deal.source}</span>}
          {deal.expected_close_date && <DueDateBadge date={deal.expected_close_date} />}
        </div>
        <div style={{ fontSize: 10, color: 'var(--arka-gray)', marginTop: 6 }}>{daysInStage}d in stage</div>
      </div>
    </div>
  )
}

function KanbanStageColumn({ stage, deals, stageValue, onCardClick, onAddCard, er }) {
  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <span className="kanban-column-title">{stage}</span>
        <span className="kanban-column-count">{deals.length}</span>
      </div>
      {stageValue > 0 && (
        <div style={{ fontSize: 11, color: 'var(--arka-orange)', fontWeight: 600, marginBottom: 8, paddingLeft: 2 }}>
          ${stageValue.toLocaleString()}
        </div>
      )}
      <SortableContext items={deals.map(d=>d.id)} strategy={verticalListSortingStrategy}>
        <div className="kanban-cards">
          {deals.map(d => (
            <SortableDealCard key={d.id} deal={d} onCardClick={onCardClick} er={er} />
          ))}
        </div>
      </SortableContext>
      <button className="kanban-add-btn" onClick={() => onAddCard(stage)}>
        <Plus size={14} /> Add
      </button>
    </div>
  )
}

function DealDetail({ deal, onClose, onMove, onDelete, onSave, er }) {
  const [editing, setEditing] = useState(false)
  const [newNote, setNewNote] = useState('')
  const daysInPipeline = differenceInDays(new Date(), new Date(deal.created_at))

  if (editing) {
    return <DealForm userId={deal.user_id} initial={deal} onSave={onSave} onCancel={() => setEditing(false)} logActivity={()=>{}} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{deal.lead_name}</h3>
          {deal.company && <p style={{ color: 'var(--arka-gray)', fontSize: 13 }}>{deal.company}</p>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--arka-orange)' }}>${(deal.deal_value||0).toLocaleString()}</div>
      </div>

      <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
        <InfoRow label="Stage" value={<span className="badge badge-orange">{deal.stage}</span>} />
        <InfoRow label="Source" value={deal.source} />
        <InfoRow label="Priority" value={deal.priority} />
        <InfoRow label="Close Date" value={deal.expected_close_date} />
        <InfoRow label="Days in Pipeline" value={`${daysInPipeline} days`} />
        <InfoRow label="PKR Value" value={`PKR ${Math.round((deal.deal_value||0)*er).toLocaleString()}`} />
      </div>

      {(deal.tags||[]).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {deal.tags.map(t => <span key={t} className="tag-pill" style={{ marginRight: 6 }}>{t}</span>)}
        </div>
      )}

      {deal.notes && (
        <div className="callout" style={{ marginBottom: 16, fontSize: 13 }}>{deal.notes}</div>
      )}

      {/* Stage history */}
      {(deal.stage_history||[]).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Stage History</div>
          {deal.stage_history.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--arka-gray)', marginBottom: 4, alignItems: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--arka-orange)', flexShrink: 0 }} />
              <span style={{ fontWeight: 500, color: 'var(--arka-black)' }}>{h.stage}</span>
              <span style={{ marginLeft: 'auto' }}>{h.changed_at ? format(new Date(h.changed_at), 'MMM d, yyyy') : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Move stage */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginBottom: 6, display: 'block' }}>Move to Stage</label>
        <select value={deal.stage} onChange={e => onMove(deal.id, e.target.value)} style={{ width: '100%' }}>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn-primary" onClick={() => onMove(deal.id, 'Closed Won')}>Mark Won</button>
        <button className="btn-secondary" onClick={() => onMove(deal.id, 'Closed Lost')} style={{ color: 'var(--arka-red)' }}>Mark Lost</button>
        <button className="btn-icon" onClick={() => onDelete(deal.id)} style={{ color: 'var(--arka-red)', marginLeft: 'auto' }}><Trash2 size={16} /></button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--arka-gray)', marginBottom: 2, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}

function DealForm({ userId, initial, initialStage, onSave, onCancel, logActivity }) {
  const [form, setForm] = useState({
    lead_name: '', company: '', deal_value: '', stage: initialStage || 'Prospecting',
    source: 'LinkedIn DM', expected_close_date: '', priority: 'Medium', tags: [], notes: '',
    ...initial
  })
  const [saving, setSaving] = useState(false)

  function f(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const payload = { ...form, deal_value: Number(form.deal_value) || 0, user_id: userId, updated_at: new Date().toISOString() }
    if (!initial) {
      payload.stage_history = [{ stage: form.stage, changed_at: new Date().toISOString() }]
      const { data } = await supabase.from('outbound_deals').insert(payload).select().single()
      logActivity?.({ type: 'outbound', action: form.stage, label: `${form.stage} - ${form.lead_name}`, ref_id: data?.id })
    } else {
      await supabase.from('outbound_deals').update(payload).eq('id', initial.id)
    }
    setSaving(false)
    onSave()
  }

  return (
    <>
      <div className="form-row">
        <div className="form-group"><label>Lead Name *</label><input value={form.lead_name} onChange={e=>f('lead_name',e.target.value)} required /></div>
        <div className="form-group"><label>Company</label><input value={form.company} onChange={e=>f('company',e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Deal Value ($)</label><input type="number" value={form.deal_value} onChange={e=>f('deal_value',e.target.value)} /></div>
        <div className="form-group"><label>Stage</label><select value={form.stage} onChange={e=>f('stage',e.target.value)}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Source</label><select value={form.source} onChange={e=>f('source',e.target.value)}><option>LinkedIn DM</option><option>Referral</option><option>Cold Email</option><option>Website</option><option>Other</option></select></div>
        <div className="form-group"><label>Priority</label><select value={form.priority} onChange={e=>f('priority',e.target.value)}><option>Urgent</option><option>High</option><option>Medium</option><option>Low</option></select></div>
      </div>
      <div className="form-group"><label>Expected Close Date</label><input type="date" value={form.expected_close_date||''} onChange={e=>f('expected_close_date',e.target.value)} /></div>
      <div className="form-group"><label>Tags</label><TagInput tags={form.tags||[]} onChange={tags=>f('tags',tags)} /></div>
      <div className="form-group"><label>Notes</label><textarea value={form.notes||''} onChange={e=>f('notes',e.target.value)} rows={3} /></div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Deal'}</button>
      </div>
    </>
  )
}
