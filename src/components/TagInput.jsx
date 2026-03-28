import React, { useState } from 'react'

export default function TagInput({ tags = [], onChange, placeholder = 'Add tag…' }) {
  const [input, setInput] = useState('')

  function addTag(raw) {
    const t = raw.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      onChange([...tags, t])
    }
    setInput('')
  }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function remove(tag) {
    onChange(tags.filter(t => t !== tag))
  }

  return (
    <div style={styles.wrap}>
      {tags.map(tag => (
        <span key={tag} className="tag-pill">
          {tag}
          <button type="button" onClick={() => remove(tag)}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) addTag(input) }}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={styles.input}
      />
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '6px 10px',
    border: '1px solid var(--arka-gray-light)',
    borderRadius: 8,
    background: 'var(--arka-white)',
    cursor: 'text',
    minHeight: 40,
    alignItems: 'center'
  },
  input: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 13,
    padding: 0,
    width: 'auto',
    minWidth: 80,
    flex: 1
  }
}
