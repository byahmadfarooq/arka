import React, { useEffect, useState } from 'react'
import { Plus, Play, Square, Trash2, Edit3, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, isPast, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useArka } from '../context/ArkaContext'
import Modal from '../components/Modal'
import TagInput from '../components/TagInput'
import DueDateBadge from '../components/DueDateBadge'
import {
  DndContext, DragOverlay, pointerWithin, rectIntersection,
  PointerSensor, useSensor, useSensors, useDroppable
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTaskTimer } from '../hooks/useTaskTimer'

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' }
]
const PRIORITIES = ['Urgent', 'High', 'Normal', 'Low']
const PRIORITY_COLORS = { Urgent: 'var(--arka-red)', High: 'var(--arka-orange)', Normal: 'var(--arka-blue)', Low: 'var(--arka-gray)' }

function formatTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function TaskManager() {
  const { user, logActivity } = useArka()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [addColumn, setAddColumn] = useState('todo')
  const [filter, setFilter] = useState({ priority: '', search: '' })

  useEffect(() => { if (user) fetchTasks() }, [user])

  async function fetchTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function handleMove(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return
    // Optimistic update — instant, no flash
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId)
    if (newStatus === 'completed') {
      logActivity({ type: 'task', action: 'Task Done', label: `Completed: ${task.title}`, ref_id: taskId })
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  const filtered = tasks.filter(t => {
    if (filter.priority && t.priority !== filter.priority) return false
    if (filter.search && !t.title.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Task Manager</h1>
          <p className="page-subtitle">No tasks. Your Monday should start with work.</p>
        </div>
        <button className="btn-primary" onClick={() => { setAddColumn('todo'); setShowAdd(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Task
        </button>
      </div>

      <div className="filters-bar">
        <input placeholder="Search tasks…" value={filter.search} onChange={e => setFilter(p => ({...p, search: e.target.value}))} style={{ width: 200 }} />
        <select value={filter.priority} onChange={e => setFilter(p => ({...p, priority: e.target.value}))}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 16 }}>{[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{width:280,height:300,borderRadius:12,flex:1}} />)}</div>
      ) : (
        <TaskKanban
          tasks={filtered}
          columns={COLUMNS}
          onMove={handleMove}
          onEdit={t => setEditTask(t)}
          onDelete={handleDelete}
          onAddCard={col => { setAddColumn(col); setShowAdd(true) }}
          onTimerStop={fetchTasks}
        />
      )}

      <Modal open={showAdd || !!editTask} onClose={() => { setShowAdd(false); setEditTask(null) }} title={editTask ? 'Edit Task' : 'New Task'}>
        <TaskForm
          userId={user?.id}
          initial={editTask || { status: addColumn }}
          onSave={() => { setShowAdd(false); setEditTask(null); fetchTasks() }}
          onCancel={() => { setShowAdd(false); setEditTask(null) }}
        />
      </Modal>
    </div>
  )
}

function TaskKanban({ tasks, columns, onMove, onEdit, onDelete, onAddCard, onTimerStop }) {
  const [activeId, setActiveId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeTask = tasks.find(t => t.id === activeId)

  function collisionDetection(args) {
    const pointer = pointerWithin(args)
    return pointer.length > 0 ? pointer : rectIntersection(args)
  }

  function handleDragStart({ active }) { setActiveId(active.id) }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const colIds = columns.map(c => c.id)
    if (colIds.includes(over.id)) {
      onMove(active.id, over.id)
    } else {
      const overTask = tasks.find(t => t.id === over.id)
      if (overTask) onMove(active.id, overTask.status)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board" style={{ alignItems: 'flex-start' }}>
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          return (
            <TaskColumn
              key={col.id}
              column={col}
              tasks={colTasks}
              onMove={onMove}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddCard={onAddCard}
              onTimerStop={onTimerStop}
            />
          )
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask ? (
          <div className="kanban-card" style={{
            borderLeft: `3px solid ${PRIORITY_COLORS[activeTask.priority] || 'var(--arka-gray-light)'}`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            transform: 'rotate(1.5deg)',
            opacity: 0.96,
            cursor: 'grabbing'
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--arka-black)', marginBottom: 4 }}>{activeTask.title}</div>
            {activeTask.priority && (
              <span style={{ fontSize: 10, fontWeight: 600, color: PRIORITY_COLORS[activeTask.priority], background: `${PRIORITY_COLORS[activeTask.priority]}18`, padding: '2px 6px', borderRadius: 999 }}>
                {activeTask.priority}
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function TaskColumn({ column, tasks, onMove, onEdit, onDelete, onAddCard, onTimerStop }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="kanban-column" style={{ flex: 1, width: 'auto', minWidth: 260, maxWidth: 400 }}>
      <div className="kanban-column-header">
        <span className="kanban-column-title">{column.label}</span>
        <span className="kanban-column-count">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t=>t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className="kanban-cards"
          style={{
            minHeight: 80,
            borderRadius: 8,
            transition: 'background 0.15s, box-shadow 0.15s',
            background: isOver ? 'rgba(249,115,22,0.06)' : undefined,
            boxShadow: isOver ? 'inset 0 0 0 2px rgba(249,115,22,0.35)' : undefined
          }}
        >
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--arka-gray)', textAlign: 'center', padding: '20px 0', opacity: 0.6 }}>
              Empty
            </div>
          ) : tasks.map(t => (
            <SortableTaskCard key={t.id} task={t} onMove={onMove} onEdit={onEdit} onDelete={onDelete} onTimerStop={onTimerStop} />
          ))}
        </div>
      </SortableContext>
      <button className="kanban-add-btn" onClick={() => onAddCard(column.id)}><Plus size={14} /> Add</button>
    </div>
  )
}

function SortableTaskCard({ task, onEdit, onDelete, onTimerStop, onMove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }
  const { running, elapsedFormatted, start, stop } = useTaskTimer(task.id, onTimerStop)

  const priorityColor = PRIORITY_COLORS[task.priority] || 'var(--arka-gray-light)'
  const isCompleted = task.status === 'completed'
  const totalTime = task.total_seconds || 0
  const colIndex = COLUMNS.findIndex(c => c.id === task.status)

  function getDueBorder() {
    if (!task.due_date) return priorityColor
    const d = parseISO(task.due_date)
    if (isPast(d) && !isToday(d)) return 'var(--arka-red)'
    if (isToday(d)) return 'var(--arka-orange)'
    return priorityColor
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="kanban-card"
        style={{ borderLeft: `3px solid ${getDueBorder()}`, opacity: isCompleted ? 0.75 : 1 }}
      >
        {/* Drag handle — whole top area */}
        <div {...attributes} {...listeners} style={{ cursor: 'grab', userSelect: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--arka-black)', textDecoration: isCompleted ? 'line-through' : 'none', flex: 1, marginRight: 8 }}>
              {task.title}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: PRIORITY_COLORS[task.priority], background: `${PRIORITY_COLORS[task.priority]}18`, padding: '2px 6px', borderRadius: 999, whiteSpace: 'nowrap' }}>
              {task.priority}
            </span>
          </div>

          {task.description && (
            <p style={{ fontSize: 12, color: 'var(--arka-gray)', marginBottom: 8, lineHeight: 1.4 }}>
              {task.description.slice(0, 80)}{task.description.length > 80 ? '…' : ''}
            </p>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {task.due_date && <DueDateBadge date={task.due_date} />}
            {task.estimated_hours && <span style={{ fontSize: 11, color: 'var(--arka-gray)' }}>Est: {task.estimated_hours}h</span>}
          </div>

          {task.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {task.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}
            </div>
          )}
        </div>

        {/* Bottom row: timer + move arrows + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--arka-gray-light)', paddingTop: 8, marginTop: 4 }}>
          {/* Timer */}
          {!isCompleted && (
            <button className="btn-icon" onClick={e => { e.stopPropagation(); running ? stop() : start() }}
              style={{ color: running ? 'var(--arka-red)' : 'var(--arka-green)', background: running ? '#FEE2E2' : '#DCFCE7' }}>
              {running ? <Square size={12} /> : <Play size={12} />}
            </button>
          )}
          {running && <span className="timer-display" style={{ fontSize: 12 }}>{elapsedFormatted}</span>}
          {totalTime > 0 && !running && (
            <span style={{ fontSize: 11, color: 'var(--arka-gray)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {formatTime(totalTime)}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Move left/right */}
            {colIndex > 0 && (
              <button className="btn-icon" title={`Move to ${COLUMNS[colIndex - 1].label}`}
                onClick={e => { e.stopPropagation(); onMove(task.id, COLUMNS[colIndex - 1].id) }}
                style={{ color: 'var(--arka-gray)', padding: '4px' }}>
                <ChevronLeft size={14} />
              </button>
            )}
            {colIndex < COLUMNS.length - 1 && (
              <button className="btn-icon" title={`Move to ${COLUMNS[colIndex + 1].label}`}
                onClick={e => { e.stopPropagation(); onMove(task.id, COLUMNS[colIndex + 1].id) }}
                style={{ color: 'var(--arka-orange)', padding: '4px' }}>
                <ChevronRight size={14} />
              </button>
            )}
            <button className="btn-icon" onClick={e => { e.stopPropagation(); onEdit(task) }}><Edit3 size={13} /></button>
            <button className="btn-icon" onClick={e => { e.stopPropagation(); onDelete(task.id) }} style={{ color: 'var(--arka-red)' }}><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskForm({ userId, initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'Normal', status: 'todo',
    due_date: '', estimated_hours: '', tags: [], linked_module: '',
    ...initial
  })
  const [saving, setSaving] = useState(false)
  function f(k,v){setForm(p=>({...p,[k]:v}))}

  async function handleSave() {
    setSaving(true)
    const payload = {
      user_id: userId,
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date || null,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      tags: form.tags,
      linked_module: form.linked_module,
      updated_at: new Date().toISOString()
    }
    if (initial?.id) {
      await supabase.from('tasks').update(payload).eq('id', initial.id)
    } else {
      await supabase.from('tasks').insert(payload)
    }
    setSaving(false)
    onSave()
  }

  return (
    <>
      <div className="form-group"><label>Title *</label><input value={form.title} onChange={e=>f('title',e.target.value)} placeholder="What needs to be done?" /></div>
      <div className="form-group"><label>Description</label><textarea value={form.description||''} onChange={e=>f('description',e.target.value)} rows={3} /></div>
      <div className="form-row">
        <div className="form-group"><label>Priority</label><select value={form.priority} onChange={e=>f('priority',e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
        <div className="form-group"><label>Status</label><select value={form.status} onChange={e=>f('status',e.target.value)}>{COLUMNS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Due Date</label><input type="date" value={form.due_date||''} onChange={e=>f('due_date',e.target.value)} /></div>
        <div className="form-group"><label>Estimated Hours</label><input type="number" value={form.estimated_hours||''} onChange={e=>f('estimated_hours',e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Tags</label><TagInput tags={form.tags||[]} onChange={tags=>f('tags',tags)} /></div>
      <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:8}}>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':initial?.id?'Save Changes':'Add Task'}</button>
      </div>
    </>
  )
}
