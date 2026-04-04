import { useState, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import Auth from './Auth'

type QuadrantType = 'doNow' | 'distractions' | 'build' | 'eliminate'

interface Task {
  id: string
  text: string
}

type TasksState = Record<QuadrantType, Task[]>

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [tasks, setTasks] = useState<TasksState>({
    doNow: [],
    distractions: [],
    build: [],
    eliminate: []
  })

  const [brainDump, setBrainDump] = useState('')
  const [isSorting, setIsSorting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) fetchTasks()
  }, [session])

  const fetchTasks = async () => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true })
    if (error) { console.error('Error fetching tasks', error); return }

    const newTasks: TasksState = { doNow: [], distractions: [], build: [], eliminate: [] }
    data?.forEach(t => {
      if (newTasks[t.quadrant as QuadrantType]) {
        newTasks[t.quadrant as QuadrantType].push({ id: t.id, text: t.text })
      }
    })
    setTasks(newTasks)
  }

  const addTask = async (quadrant: QuadrantType, text: string) => {
    if (!text.trim() || !session?.user) return
    const newTaskObj = { user_id: session.user.id, text: text.trim(), quadrant }
    
    const { data, error } = await supabase.from('tasks').insert([newTaskObj]).select()
    if (error) { console.error("Error inserting:", error); return }
    
    if (data && data[0]) {
      setTasks(prev => ({
        ...prev,
        [quadrant]: [...prev[quadrant], { id: data[0].id, text: data[0].text }]
      }))
    }
  }

  const removeTask = async (quadrant: QuadrantType, taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) { console.error("Error deleting:", error); return }
    setTasks(prev => ({
      ...prev,
      [quadrant]: prev[quadrant].filter(t => t.id !== taskId)
    }))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, quadrant: QuadrantType) => {
    if (e.key === 'Enter') {
      addTask(quadrant, e.currentTarget.value)
      e.currentTarget.value = ''
    }
  }

  const breakDownTask = async (quadrant: QuadrantType, taskId: string) => {
    // Phase 1: Skeleton for future AI integration
    alert(`AI breakdown triggered for task ID: ${taskId} in quadrant: ${quadrant}. Will be connected in Phase 3.`)
  }

  const handleAutoSort = async () => {
    if (!brainDump.trim()) return
    setIsSorting(true)
    setErrorMsg('')
    try {
      // Phase 1: Skeleton for future AI integration
      setTimeout(() => {
        alert("Auto-sort activated. This will connect to Gemini in Phase 3.")
        setIsSorting(false)
        setBrainDump('')
      }, 1000)
    } catch (err) {
      setErrorMsg('Failed to sort. API not connected yet.')
      setIsSorting(false)
    }
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className="slide-container">
      <div className="header" style={{ justifyContent: 'space-between', width: '100%' }}>
        <h1><span className="bolt-icon">⚡</span> THE MATRIX</h1>
        <button 
          onClick={() => supabase.auth.signOut()} 
          style={{ background: 'transparent', border: '1px solid #404040', color: '#a1a1aa', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
          Log Out
        </button>
      </div>

      <div className="matrix-board">
        {/* Top row: Headers */}
        <div className="empty-corner"></div>
        <div className="col-header">IMPORTANT</div>
        <div className="col-header">NOT IMPORTANT</div>

        {/* Middle row */}
        <div className="row-header">URGENT</div>
        <div className="quadrant border-right border-bottom">
          <div className="mobile-label">Important / Urgent</div>
          <div className="q-title">
            <span className="dot red"></span> DO NOW
          </div>
          <div className="task-list">
            {tasks.doNow.map(task => (
              <div key={task.id} className="task">
                <span className="checkbox" onClick={() => removeTask('doNow', task.id)} title="Mark complete"></span>
                <div className="task-text">{task.text}</div>
                <div className="task-actions">
                  <button className="breakdown-btn" title="✨ Break down with AI" onClick={() => breakDownTask('doNow', task.id)}>✨</button>
                </div>
              </div>
            ))}
          </div>
          <input 
            type="text" 
            className="task-input" 
            placeholder="+ Add task..." 
            onKeyDown={(e) => handleKeyDown(e, 'doNow')}
          />
        </div>
        <div className="quadrant border-bottom">
          <div className="mobile-label">Not Important / Urgent</div>
          <div className="q-title">
            <span className="dot yellow"></span> DISTRACTIONS
          </div>
          <div className="task-list">
            {tasks.distractions.map(task => (
              <div key={task.id} className="task">
                <span className="checkbox" onClick={() => removeTask('distractions', task.id)} title="Mark complete"></span>
                <div className="task-text">{task.text}</div>
                <div className="task-actions">
                  <button className="breakdown-btn" title="✨ Break down with AI" onClick={() => breakDownTask('distractions', task.id)}>✨</button>
                </div>
              </div>
            ))}
          </div>
          <input 
            type="text" 
            className="task-input" 
            placeholder="+ Add task..." 
            onKeyDown={(e) => handleKeyDown(e, 'distractions')}
          />
        </div>

        {/* Bottom row */}
        <div className="row-header">NOT URGENT</div>
        <div className="quadrant border-right">
          <div className="mobile-label">Important / Not Urgent</div>
          <div className="q-title">
            <span className="dot green"></span> BUILD
          </div>
          <div className="task-list">
            {tasks.build.map(task => (
              <div key={task.id} className="task">
                <span className="checkbox" onClick={() => removeTask('build', task.id)} title="Mark complete"></span>
                <div className="task-text">{task.text}</div>
                <div className="task-actions">
                  <button className="breakdown-btn" title="✨ Break down with AI" onClick={() => breakDownTask('build', task.id)}>✨</button>
                </div>
              </div>
            ))}
          </div>
          <input 
            type="text" 
            className="task-input" 
            placeholder="+ Add task..." 
            onKeyDown={(e) => handleKeyDown(e, 'build')}
          />
        </div>
        <div className="quadrant">
          <div className="mobile-label">Not Important / Not Urgent</div>
          <div className="q-title">
            <span className="dot purple"></span> ELIMINATE
          </div>
          <div className="task-list">
            {tasks.eliminate.map(task => (
              <div key={task.id} className="task">
                <span className="checkbox" onClick={() => removeTask('eliminate', task.id)} title="Mark complete"></span>
                <div className="task-text">{task.text}</div>
                <div className="task-actions">
                  <button className="breakdown-btn" title="✨ Break down with AI" onClick={() => breakDownTask('eliminate', task.id)}>✨</button>
                </div>
              </div>
            ))}
          </div>
          <input 
            type="text" 
            className="task-input" 
            placeholder="+ Add task..." 
            onKeyDown={(e) => handleKeyDown(e, 'eliminate')}
          />
        </div>
      </div>

      <div className="brain-dump">
        <h3><span className="bolt-icon" style={{ fontSize: '24px' }}>✨</span> AI Task Sorter</h3>
        <textarea
          value={brainDump}
          onChange={(e) => setBrainDump(e.target.value)}
          placeholder="Brain dump your thoughts here (e.g., 'buy groceries, plan Q3 roadmap, scroll twitter, read a book'). Let Gemini categorize them into the matrix!"
        />
        <button 
          id="autoSortBtn" 
          className="gemini-btn" 
          onClick={handleAutoSort}
          disabled={isSorting || !brainDump.trim()}
        >
          ✨ Auto-Sort Tasks
          {isSorting && <span className="loading-spinner" style={{ display: 'inline-block' }}>⏳</span>}
        </button>
        {errorMsg && <div style={{ color: '#ef4444', fontSize: '14px' }}>{errorMsg}</div>}
      </div>
    </div>
  )
}

export default App
