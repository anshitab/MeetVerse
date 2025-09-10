import { useEffect, useRef, useState } from 'react';

function Auth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', phone: '' });
  const [transitionKey, setTransitionKey] = useState(0);
  const exitingRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    // Placeholder: persist locally; in real app, send to backend
    localStorage.setItem('mv_user', JSON.stringify(form));
    window.location.href = '/';
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
            <div className="stack">
              <label>Username</label>
              <input className="input" value={form.username} onChange={(e)=>setForm({...form, username:e.target.value})} required />
            </div>
            <div className="stack">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} required />
            </div>
            <div className="stack">
              <label>Phone</label>
              <input className="input" type="tel" value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} required />
            </div>
            <button className="button" type="submit">{mode === 'login' ? 'Login' : 'Create account'}</button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Auth;
