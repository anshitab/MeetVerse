import { useEffect, useRef, useState } from 'react';


function Auth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', identifier: '' });
  const [transitionKey, setTransitionKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const exitingRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
      if (mode === 'signup') {
        const resp = await fetch(`${apiBase}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            username: form.username || undefined, // allow server to auto-generate
            password: form.password,
          })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'Signup failed');
        localStorage.setItem('mv_user', JSON.stringify(data));
        window.location.href = '/';
        return;
      }

      // Real login: identifier (email or username) + password
      const resp = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.identifier || form.email || form.username, password: form.password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Login failed');
      localStorage.setItem('mv_user', JSON.stringify(data));
      window.location.href = '/';
    } catch (err) {
      setError(err?.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // bump key to re-trigger animation on mode switch
    setTransitionKey(k => k + 1);
  }, [mode]);

  return (
    <div className="container page">
      <header className="header card">
        <div className="brand">
          <div className="brand-mark" />
          <span>MeetVerse</span>
        </div>
        <div className="row">
          <a className="button secondary" href="/">Home</a>
        </div>
      </header>

      <main className="card switcher" style={{ padding: 24, marginTop: 24, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>{mode === 'login' ? 'Login' : 'Sign up'}</h2>
          <button className="button secondary" onClick={() => setMode(m => m==='login'?'signup':'login')}>
            Switch to {mode === 'login' ? 'Sign up' : 'Login'}
          </button>
        </div>
        <div key={transitionKey} className="switcher-inner">
          <form className="stack" style={{ marginTop: 16 }} onSubmit={submit}>
            {mode === 'signup' && (
              <>
                <div className="stack">
                  <label>Name</label>
                  <input className="input" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} />
                </div>
              </>
            )}
            {mode === 'login' ? (
              <>
                <div className="stack">
                  <label>Email or Username</label>
                  <input className="input" value={form.identifier} onChange={(e)=>setForm({...form, identifier:e.target.value})} required />
                </div>
                <div className="stack">
                  <label>Password</label>
                  <input className="input" type="password" value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})} required />
                </div>
              </>
            ) : (
              <>
                <div className="stack">
                  <label>Username <span style={{opacity:0.6}}>(optional)</span></label>
                  <input className="input" value={form.username} onChange={(e)=>setForm({...form, username:e.target.value})} placeholder={'leave blank to auto-generate'} />
                </div>
                <div className="stack">
                  <label>Email</label>
                  <input className="input" type="email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} required />
                </div>
                <div className="stack">
                  <label>Password</label>
                  <input className="input" type="password" value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})} required />
                </div>
              </>
            )}
            {error && <div className="row" style={{ color: 'crimson' }}>{error}</div>}
            <button className="button" type="submit" disabled={submitting}>{submitting ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Create account')}</button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Auth;
