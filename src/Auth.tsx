import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) alert(error.message)
      else alert("Success! You can now sign in (or check your email for a confirmation link if configured).")
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2><span className="bolt-icon">⚡</span> MATRIX LOGIN</h2>
        <form onSubmit={handleAuth} className="auth-form">
          <input 
            className="auth-input"
            type="email" 
            placeholder="Email" 
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            className="auth-input"
            type="password" 
            placeholder="Password" 
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="gemini-btn auth-btn" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        <button type="button" className="auth-switch" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Need an account? Sign Up" : "Have an account? Sign In"}
        </button>
      </div>
    </div>
  )
}
