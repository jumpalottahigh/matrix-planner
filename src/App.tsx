import { useState, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import Auth from './Auth'
import { fetchGeminiWithRetry } from './gemini'
import CompletedView from './Completed'

type QuadrantType = 'doNow' | 'distractions' | 'build' | 'eliminate'

interface Task {
  id: string
  text: string
}

type TasksState = Record<QuadrantType, Task[]>

function App() {
  const [currentTab, setCurrentTab] = useState<'matrix' | 'completed'>('matrix')
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
  const [breakingDownIds, setBreakingDownIds] = useState<string[]>([])
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session && currentTab === 'matrix') fetchTasks()
  }, [session, currentTab])

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Error fetching tasks', error)
      return
    }

    const newTasks: TasksState = {
      doNow: [],
      distractions: [],
      build: [],
      eliminate: []
    }

    const now = new Date()
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime()

    data?.forEach((t) => {
      const isCreatedToday = new Date(t.created_at).getTime() >= startOfToday
      if (t.status === 'active' && isCreatedToday) {
        if (newTasks[t.quadrant as QuadrantType]) {
          newTasks[t.quadrant as QuadrantType].push({ id: t.id, text: t.text })
        }
      }
    })
    setTasks(newTasks)
  }

  const addTask = async (quadrant: QuadrantType, text: string) => {
    if (!text.trim() || !session?.user) return
    const newTaskObj = { user_id: session.user.id, text: text.trim(), quadrant }

    const { data, error } = await supabase
      .from('tasks')
      .insert([newTaskObj])
      .select()
    if (error) {
      console.error('Error inserting:', error)
      return
    }

    if (data && data[0]) {
      setTasks((prev) => ({
        ...prev,
        [quadrant]: [...prev[quadrant], { id: data[0].id, text: data[0].text }]
      }))
    }
  }

  const completeTask = async (quadrant: QuadrantType, taskId: string) => {
    setActiveDropdownId(null)
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) {
      console.error('Error completing:', error)
      return
    }
    setTasks((prev) => ({
      ...prev,
      [quadrant]: prev[quadrant].filter((t) => t.id !== taskId)
    }))
  }

  const hardDeleteTask = async (quadrant: QuadrantType, taskId: string) => {
    setActiveDropdownId(null)
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) {
      setTasks((prev) => ({
        ...prev,
        [quadrant]: prev[quadrant].filter((t) => t.id !== taskId)
      }))
    }
  }

  const moveTask = async (
    taskId: string,
    sourceQ: QuadrantType,
    targetQ: QuadrantType
  ) => {
    setActiveDropdownId(null)
    const { error } = await supabase
      .from('tasks')
      .update({ quadrant: targetQ })
      .eq('id', taskId)
    if (!error) {
      setTasks((prev) => {
        const task = prev[sourceQ].find((t) => t.id === taskId)
        if (!task) return prev
        return {
          ...prev,
          [sourceQ]: prev[sourceQ].filter((t) => t.id !== taskId),
          [targetQ]: [...prev[targetQ], task]
        }
      })
    }
  }

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    quadrant: QuadrantType
  ) => {
    if (e.key === 'Enter') {
      addTask(quadrant, e.currentTarget.value)
      e.currentTarget.value = ''
    }
  }

  const renderTaskActions = (task: Task, currentQ: QuadrantType) => {
    const isOpen = activeDropdownId === task.id
    const otherQs = ['doNow', 'distractions', 'build', 'eliminate'].filter(
      (q) => q !== currentQ
    ) as QuadrantType[]
    const qMap: Record<QuadrantType, string> = {
      doNow: 'Do Now',
      distractions: 'Distractions',
      build: 'Build',
      eliminate: 'Eliminate'
    }

    return (
      <div className='dropdown-container'>
        <button
          className='kebab-btn'
          onClick={() => setActiveDropdownId(isOpen ? null : task.id)}
        >
          ⋮
        </button>
        {isOpen && (
          <>
            <div
              className='dropdown-overlay'
              onClick={() => setActiveDropdownId(null)}
            ></div>
            <div className='dropdown-menu'>
              <button
                className='dropdown-item'
                onClick={() => {
                  setActiveDropdownId(null)
                  breakDownTask(currentQ, task.id)
                }}
              >
                ✨ Break down with AI
              </button>
              <div className='dropdown-separator'></div>
              {otherQs.map((q) => (
                <button
                  key={q}
                  className='dropdown-item'
                  onClick={() => moveTask(task.id, currentQ, q)}
                >
                  ⇨ Move to {qMap[q]}
                </button>
              ))}
              <div className='dropdown-separator'></div>
              <button
                className='dropdown-item'
                style={{ color: '#ef4444' }}
                onClick={() => hardDeleteTask(currentQ, task.id)}
              >
                🗑️ Delete task
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const breakDownTask = async (quadrant: QuadrantType, taskId: string) => {
    const taskObj = tasks[quadrant].find((t) => t.id === taskId)
    if (!taskObj) return

    setBreakingDownIds((prev) => [...prev, taskId])

    const payload = {
      contents: [
        {
          parts: [
            {
              text:
                'Break down this task into 2-3 short, actionable sub-tasks: ' +
                taskObj.text
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: "You break down tasks into smaller steps. Return a JSON object with a 'subtasks' array of strings. Keep them extremely concise (2-4 words each if possible)."
          }
        ]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            subtasks: { type: 'ARRAY', items: { type: 'STRING' } }
          }
        }
      }
    }

    try {
      const result = await fetchGeminiWithRetry(payload)
      const textResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text

      if (textResponse) {
        const data = JSON.parse(textResponse)
        const newTasks = data.subtasks.map((t: string) => ({
          user_id: session?.user.id,
          text: '↳ ' + t,
          quadrant
        }))

        const { data: insertedData, error } = await supabase
          .from('tasks')
          .insert(newTasks)
          .select()
        if (!error && insertedData) {
          setTasks((prev) => {
            const newArr = [...prev[quadrant]]
            const originalIndex = newArr.findIndex((t) => t.id === taskId)
            if (originalIndex !== -1) {
              const itemsToInsert = insertedData.map((d) => ({
                id: d.id,
                text: d.text
              }))
              newArr.splice(originalIndex + 1, 0, ...itemsToInsert)
            }
            return { ...prev, [quadrant]: newArr }
          })
        }
      }
    } catch (err) {
      console.error(err)
      alert('Failed to break down. Check API key.')
    } finally {
      setBreakingDownIds((prev) => prev.filter((id) => id !== taskId))
    }
  }

  const handleAutoSort = async () => {
    if (!brainDump.trim()) return
    setIsSorting(true)
    setErrorMsg('')
    try {
      const payload = {
        contents: [
          { parts: [{ text: 'Categorize these tasks: ' + brainDump }] }
        ],
        systemInstruction: {
          parts: [
            {
              text: 'You are an Eisenhower Matrix expert. Categorize the provided tasks into exactly one of these four categories: \'doNow\' (Urgent & Important), \'build\' (Not Urgent & Important), \'distractions\' (Urgent & Not Important), \'eliminate\' (Not Urgent & Not Important). Reply with a valid JSON object matching this schema: { "tasks": [ { "title": "task name", "quadrant": "doNow|build|distractions|eliminate" } ] }. No markdown formatting, just pure JSON. Keep task titles concise.'
            }
          ]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              tasks: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    quadrant: {
                      type: 'STRING',
                      enum: ['doNow', 'build', 'distractions', 'eliminate']
                    }
                  }
                }
              }
            }
          }
        }
      }

      const result = await fetchGeminiWithRetry(payload)
      const textResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text
      if (textResponse) {
        const data = JSON.parse(textResponse)
        const newTasks = data.tasks.map((t: any) => ({
          user_id: session?.user.id,
          text: t.title,
          quadrant: t.quadrant
        }))

        const { data: insertedData, error } = await supabase
          .from('tasks')
          .insert(newTasks)
          .select()
        if (!error && insertedData) {
          setTasks((prev) => {
            const nextState = { ...prev }
            insertedData.forEach((d) => {
              nextState[d.quadrant as QuadrantType] = [
                ...nextState[d.quadrant as QuadrantType],
                { id: d.id, text: d.text }
              ]
            })
            return nextState
          })
          setBrainDump('')
        } else if (error) {
          setErrorMsg('Database error saving tasks.')
        }
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Failed to sort. Check API key.')
    } finally {
      setIsSorting(false)
    }
  }

  if (!session) {
    return <Auth />
  }

  return (
    <div className='app-wrapper'>
      {currentTab === 'matrix' ? (
        <div className='slide-container'>
          <div
            className='header'
            style={{ justifyContent: 'space-between', width: '100%' }}
          >
            <h1>
              <span className='bolt-icon'>⚡</span> Matrix Planner
            </h1>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                background: 'transparent',
                border: '1px solid #404040',
                color: '#a1a1aa',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Log Out
            </button>
          </div>

          <div className='matrix-board'>
            {/* Top row: Headers */}
            <div className='empty-corner'></div>
            <div className='col-header'>IMPORTANT</div>
            <div className='col-header'>NOT IMPORTANT</div>

            {/* Middle row */}
            <div className='row-header'>URGENT</div>
            <div className='quadrant border-right border-bottom'>
              <div className='q-title'>
                <span className='dot red'></span> DO NOW
              </div>
              <div className='mobile-label'>Important / Urgent</div>
              <div className='task-list'>
                {tasks.doNow.map((task) => (
                  <div key={task.id} className='task'>
                    <span
                      className='checkbox'
                      onClick={() => completeTask('doNow', task.id)}
                      title='Mark complete'
                    ></span>
                    <div className='task-text'>
                      {breakingDownIds.includes(task.id)
                        ? `⏳ Breaking down...`
                        : task.text}
                    </div>
                    <div className='task-actions'>
                      {renderTaskActions(task, 'doNow')}
                    </div>
                  </div>
                ))}
              </div>
              <input
                type='text'
                className='task-input'
                placeholder='+ Add task...'
                onKeyDown={(e) => handleKeyDown(e, 'doNow')}
              />
            </div>
            <div className='quadrant border-bottom'>
              <div className='q-title'>
                <span className='dot yellow'></span> DISTRACTIONS
              </div>
              <div className='mobile-label'>Not Important / Urgent</div>
              <div className='task-list'>
                {tasks.distractions.map((task) => (
                  <div key={task.id} className='task'>
                    <span
                      className='checkbox'
                      onClick={() => completeTask('distractions', task.id)}
                      title='Mark complete'
                    ></span>
                    <div className='task-text'>
                      {breakingDownIds.includes(task.id)
                        ? `⏳ Breaking down...`
                        : task.text}
                    </div>
                    <div className='task-actions'>
                      {renderTaskActions(task, 'distractions')}
                    </div>
                  </div>
                ))}
              </div>
              <input
                type='text'
                className='task-input'
                placeholder='+ Add task...'
                onKeyDown={(e) => handleKeyDown(e, 'distractions')}
              />
            </div>

            {/* Bottom row */}
            <div className='row-header'>NOT URGENT</div>
            <div className='quadrant border-right'>
              <div className='q-title'>
                <span className='dot green'></span> BUILD
              </div>
              <div className='mobile-label'>Important / Not Urgent</div>
              <div className='task-list'>
                {tasks.build.map((task) => (
                  <div key={task.id} className='task'>
                    <span
                      className='checkbox'
                      onClick={() => completeTask('build', task.id)}
                      title='Mark complete'
                    ></span>
                    <div className='task-text'>
                      {breakingDownIds.includes(task.id)
                        ? `⏳ Breaking down...`
                        : task.text}
                    </div>
                    <div className='task-actions'>
                      {renderTaskActions(task, 'build')}
                    </div>
                  </div>
                ))}
              </div>
              <input
                type='text'
                className='task-input'
                placeholder='+ Add task...'
                onKeyDown={(e) => handleKeyDown(e, 'build')}
              />
            </div>
            <div className='quadrant'>
              <div className='q-title'>
                <span className='dot purple'></span> ELIMINATE
              </div>
              <div className='mobile-label'>Not Important / Not Urgent</div>
              <div className='task-list'>
                {tasks.eliminate.map((task) => (
                  <div key={task.id} className='task'>
                    <span
                      className='checkbox'
                      onClick={() => completeTask('eliminate', task.id)}
                      title='Mark complete'
                    ></span>
                    <div className='task-text'>
                      {breakingDownIds.includes(task.id)
                        ? `⏳ Breaking down...`
                        : task.text}
                    </div>
                    <div className='task-actions'>
                      {renderTaskActions(task, 'eliminate')}
                    </div>
                  </div>
                ))}
              </div>
              <input
                type='text'
                className='task-input'
                placeholder='+ Add task...'
                onKeyDown={(e) => handleKeyDown(e, 'eliminate')}
              />
            </div>
          </div>

          <div className='brain-dump'>
            <h3>
              <span className='bolt-icon' style={{ fontSize: '24px' }}>
                ✨
              </span>{' '}
              AI Task Sorter
            </h3>
            <textarea
              value={brainDump}
              onChange={(e) => setBrainDump(e.target.value)}
              placeholder="Brain dump your thoughts here (e.g., 'buy groceries, plan Q3 roadmap, scroll twitter, read a book'). Let Gemini categorize them into the matrix!"
            />
            <button
              id='autoSortBtn'
              className='gemini-btn'
              onClick={handleAutoSort}
              disabled={isSorting || !brainDump.trim()}
            >
              ✨ Auto-Sort Tasks
              {isSorting && (
                <span
                  className='loading-spinner'
                  style={{ display: 'inline-block' }}
                >
                  ⏳
                </span>
              )}
            </button>
            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '14px' }}>
                {errorMsg}
              </div>
            )}
          </div>

          <footer className='footer'>
            <p>
              Copyright ©{' '}
              {new Date().getFullYear() === 2026
                ? '2026'
                : '2026-' + new Date().getFullYear()}{' '}
              Georgi Yanev
            </p>
          </footer>
        </div>
      ) : (
        <CompletedView />
      )}

      <div className='bottom-nav'>
        <button
          className={currentTab === 'matrix' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setCurrentTab('matrix')}
        >
          ⚡ Matrix
        </button>
        <button
          className={currentTab === 'completed' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setCurrentTab('completed')}
        >
          ✅ Timeline
        </button>
      </div>
    </div>
  )
}

export default App
