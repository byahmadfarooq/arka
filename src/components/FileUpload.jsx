import React, { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function FileUpload({ bucket = 'arka-media', path, onUpload, accept = 'image/*', multiple = false, label = 'Upload File' }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(files) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')

    try {
      if (multiple) {
        const urls = []
        for (const file of files) {
          const ext = file.name.split('.').pop()
          const filePath = `${path}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true })
          if (upErr) throw upErr
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
          urls.push(urlData.publicUrl)
        }
        onUpload(urls)
      } else {
        const file = files[0]
        const ext = file.name.split('.').pop()
        const filePath = `${path}.${ext}`
        const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)
        onUpload(urlData.publicUrl)
      }
    } catch (e) {
      setError(e.message || 'Upload failed')
    }

    setUploading(false)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={`file-upload-area ${dragging ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={e => handleFiles(e.target.files)}
      />
      <Upload size={20} color="var(--arka-orange)" style={{ marginBottom: 6 }} />
      <p style={{ fontSize: 13, color: 'var(--arka-gray)' }}>
        {uploading ? 'Uploading…' : <><strong style={{ color: 'var(--arka-orange)' }}>{label}</strong> or drag & drop</>}
      </p>
      {error && <p style={{ fontSize: 12, color: 'var(--arka-red)', marginTop: 4 }}>{error}</p>}
    </div>
  )
}
