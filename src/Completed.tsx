import { useState, useEffect } from 'react'
import { supabase } from './supabase'

interface HistoryTask {
  id: string
  text: string
  quadrant: string
  status: 'active' | 'completed'
  created_at: string
  completed_at: string | null
}

export default function CompletedView() {
  const [tasks, setTasks] = useState<HistoryTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) {
      const now = new Date()
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime()

      const historyList = data.filter((t) => {
        const isCompleted = t.status === 'completed'
        const createdTime = new Date(t.created_at).getTime()
        const isExpiredActive =
          t.status === 'active' && createdTime < startOfToday
        return isCompleted || isExpiredActive
      })

      // Sort history list mostly by completion time, fallback to creation
      historyList.sort((a, b) => {
        const timeA = a.completed_at
          ? new Date(a.completed_at).getTime()
          : new Date(a.created_at).getTime()
        const timeB = b.completed_at
          ? new Date(b.completed_at).getTime()
          : new Date(b.created_at).getTime()
        return timeB - timeA
      })

      setTasks(historyList)
    }
    setLoading(false)
  }

  const hardDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id))
    }
  }

  const restoreTask = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'active',
        created_at: new Date().toISOString(),
        completed_at: null
      })
      .eq('id', id)
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== id))
    }
  }

  const groupedTasks: Record<string, HistoryTask[]> = {}

  tasks.forEach((t) => {
    let dateKey = ''
    const refDate = t.completed_at
      ? new Date(t.completed_at)
      : new Date(t.created_at)

    const now = new Date()
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime()
    const startOfYesterday = startOfToday - 86400000
    const refTime = refDate.getTime()

    if (refTime >= startOfToday) dateKey = 'Today'
    else if (refTime >= startOfYesterday) dateKey = 'Yesterday'
    else
      dateKey = refDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })

    if (!groupedTasks[dateKey]) groupedTasks[dateKey] = []
    groupedTasks[dateKey].push(t)
  })

  if (loading)
    return (
      <div
        className='slide-container completed-view'
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <h2 style={{ color: '#888' }}>Loading Timeline...</h2>
      </div>
    )

  const qMap: any = {
    doNow: 'DO NOW',
    distractions: 'DISTRACTIONS',
    build: 'BUILD',
    eliminate: 'ELIMINATE'
  }

  return (
    <div className='slide-container completed-view'>
      <div className='header'>
        <h1>
          <span className='bolt-icon'>✅</span> TIMELINE
        </h1>
      </div>

      {Object.keys(groupedTasks).length === 0 ? (
        <div
          style={{
            color: '#888',
            textAlign: 'center',
            marginTop: '80px',
            fontSize: '18px'
          }}
        >
          No history yet! Start matrixing to build your timeline.
        </div>
      ) : (
        <div className='timeline-list'>
          {Object.entries(groupedTasks).map(([date, dayTasks]) => (
            <div key={date} className='timeline-group'>
              <h3 className='timeline-date'>{date}</h3>
              <div className='timeline-items'>
                {dayTasks.map((t) => (
                  <div key={t.id} className='timeline-item'>
                    <span className='timeline-icon'>
                      {t.status === 'completed' ? '✅' : '⭕'}
                    </span>
                    <div className='timeline-content'>
                      <div
                        className='timeline-text'
                        style={{
                          textDecoration:
                            t.status === 'completed' ? 'line-through' : 'none',
                          color:
                            t.status === 'completed' ? '#a1a1aa' : '#ef4444'
                        }}
                      >
                        {t.text}
                      </div>
                      <div className='timeline-meta'>
                        {qMap[t.quadrant]} •{' '}
                        {t.status === 'completed'
                          ? `Done at ${new Date(t.completed_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : `Missed from ${new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    </div>
                    <button
                      className='restore-btn'
                      onClick={() => restoreTask(t.id)}
                      title='Return to Matrix'
                    >
                      ↺
                    </button>
                    <button
                      className='hard-delete-btn'
                      onClick={() => hardDeleteTask(t.id)}
                      title='Delete forever'
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
