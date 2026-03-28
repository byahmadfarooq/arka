import React from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'

function SortableCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

export default function KanbanBoard({ columns, cards, onCardMove, onCardClick, renderCard, onAddCard }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [activeId, setActiveId] = React.useState(null)

  function handleDragStart({ active }) {
    setActiveId(active.id)
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    // Find which column the over item belongs to
    const overCard = cards.find(c => c.id === over.id)
    const overColumn = overCard?.stage || overCard?.status || overCard?.column_id || over.id

    // over.id could be a column id (droppable) or a card id
    const targetColumn = columns.find(col => col.id === over.id)
    if (targetColumn) {
      onCardMove(active.id, targetColumn.id)
    } else if (overCard) {
      const col = columns.find(c => c.id === overColumn)
      if (col) onCardMove(active.id, col.id)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {columns.map(col => {
          const colCards = cards.filter(c =>
            (c.stage || c.status || c.column_id) === col.id
          )
          return (
            <KanbanColumn
              key={col.id}
              column={col}
              cards={colCards}
              onCardClick={onCardClick}
              renderCard={renderCard}
              onAddCard={onAddCard}
              onDropOnColumn={onCardMove}
            />
          )
        })}
      </div>
    </DndContext>
  )
}

function KanbanColumn({ column, cards, onCardClick, renderCard, onAddCard, onDropOnColumn }) {
  const { setNodeRef, isOver } = useSortable ? {} : {}

  return (
    <div
      className="kanban-column"
      style={isOver ? { outline: '2px solid var(--arka-orange)' } : {}}
    >
      <div className="kanban-column-header">
        <span className="kanban-column-title">{column.label}</span>
        <span className="kanban-column-count">{cards.length}</span>
      </div>

      {column.valueLabel && cards.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--arka-orange)', fontWeight: 600, marginBottom: 6, paddingLeft: 2 }}>
          {column.valueLabel}
        </div>
      )}

      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="kanban-cards">
          {cards.map(card => (
            <SortableCard key={card.id} id={card.id}>
              <div onClick={() => onCardClick?.(card)}>
                {renderCard(card, column)}
              </div>
            </SortableCard>
          ))}
        </div>
      </SortableContext>

      {onAddCard && (
        <button
          className="kanban-add-btn"
          onClick={() => onAddCard(column.id)}
        >
          <Plus size={14} />
          Add
        </button>
      )}
    </div>
  )
}
