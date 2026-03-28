import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'arka_active_timer'

export function useTaskTimer(taskId, onStop) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)
  const startRef = useRef(null)

  // On mount, check if this timer was active
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const { id, startedAt } = JSON.parse(stored)
        if (id === taskId) {
          startRef.current = new Date(startedAt)
          setRunning(true)
        }
      } catch {}
    }
    return () => clearInterval(intervalRef.current)
  }, [taskId])

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startRef.current) / 1000)
        setElapsed(secs)
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
      setElapsed(0)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  function start() {
    // Stop any other running timer first
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const prev = JSON.parse(stored)
        if (prev.id !== taskId) {
          // Different timer was running — just clear it (no save)
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {}
    }
    startRef.current = new Date()
    setRunning(true)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: taskId, startedAt: startRef.current.toISOString() }))
  }

  async function stop() {
    if (!running || !startRef.current) return
    clearInterval(intervalRef.current)
    setRunning(false)

    const stoppedAt = new Date()
    const duration = Math.floor((stoppedAt - startRef.current) / 1000)
    const logEntry = {
      started_at: startRef.current.toISOString(),
      stopped_at: stoppedAt.toISOString(),
      duration_seconds: duration
    }

    localStorage.removeItem(STORAGE_KEY)

    // Fetch current task to get existing logs + total
    const { data: task } = await supabase
      .from('tasks')
      .select('time_logs, total_seconds')
      .eq('id', taskId)
      .single()

    const existingLogs = task?.time_logs || []
    const existingTotal = task?.total_seconds || 0

    await supabase
      .from('tasks')
      .update({
        time_logs: [...existingLogs, logEntry],
        total_seconds: existingTotal + duration,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)

    setElapsed(0)
    onStop?.()
  }

  function formatElapsed(secs) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return { running, elapsed, elapsedFormatted: formatElapsed(elapsed), start, stop }
}
