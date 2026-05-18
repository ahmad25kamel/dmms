import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px 10px 38px',
  border: '1.5px solid var(--border-2)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14, color: 'var(--fg-0)',
  background: 'var(--bg-1)',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: 'var(--font-sans)',
};

function Field({ label, hint, icon, children }: { label: string; hint?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-4)', pointerEvents: 'none' }}>{icon}</div>
        {children}
      </div>
      {hint && <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--fg-4)' }}>{hint}</p>}
    </div>
  );
}

export function RegisterPage() {
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'contributor' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--kamel-blue)';
    e.target.style.boxShadow = 'var(--shadow-focus)';
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--border-2)';
    e.target.style.boxShadow = 'none';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await authApi.register({ username: form.username, name: form.name, password: form.password, role: form.role });
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', padding: 24, fontFamily: 'var(--font-sans)' }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FFFBEB', border: '2px solid var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg-0)', letterSpacing: '-0.03em', marginBottom: 10 }}>Request submitted</h2>
          <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.65, marginBottom: 6 }}>
            Your account has been created and is pending admin approval.
          </p>
          <p style={{ fontSize: 13, color: 'var(--fg-4)', marginBottom: 28 }}>
            Registered as <strong style={{ color: 'var(--fg-2)' }}>{form.name}</strong> (@{form.username}) · {form.role === 'pm' ? 'Project Manager' : 'Contributor'}
          </p>
          <div style={{ background: '#FFFBEB', border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 28, textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>An administrator will review your request. You'll be able to sign in once approved.</p>
            </div>
          </div>
          <Link to="/login" style={{
            display: 'block', width: '100%', padding: '11px 0', textAlign: 'center',
            background: 'var(--gradient-brand)', color: '#fff', borderRadius: 'var(--radius-md)',
            fontSize: 14, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.01em',
            boxShadow: '0 1px 2px rgba(37,99,235,0.3), 0 4px 12px rgba(37,99,235,0.2)',
          }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-sans)' }}>
      {/* ── Left panel ── */}
      <div style={{
        display: 'none',
        width: '45%',
        background: 'linear-gradient(150deg, #1e3a8a 0%, #2563EB 55%, #3b82f6 100%)',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px',
        position: 'relative',
        overflow: 'hidden',
        ...(window.innerWidth >= 900 ? { display: 'flex' } : {}),
      }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: -120, right: -120, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', bottom: 60, left: -80, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
              <path d="M9 12l3-4 3 4M9 16h6"/>
            </svg>
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>DM<span style={{ opacity: 0.75 }}>MS</span></span>
        </div>

        <div>
          <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Join the<br />platform.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65, maxWidth: 320 }}>
            Sign up to start contributing to projects or managing your deliverable pipelines.
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px 24px', backdropFilter: 'blur(8px)' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Two roles available</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { role: 'Contributor', desc: 'Browse marketplace, submit bids, complete work' },
              { role: 'Project Manager', desc: 'Create projects, review proposals, approve work' },
            ].map(r => (
              <div key={r.role} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{r.role}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, ...(window.innerWidth >= 900 ? { display: 'none' } as React.CSSProperties : {}) }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
                <path d="M9 12l3-4 3 4M9 16h6"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--fg-0)' }}>DM<span style={{ color: 'var(--kamel-blue)' }}>MS</span></span>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-0)', letterSpacing: '-0.03em', marginBottom: 6 }}>Create account</h2>
            <p style={{ fontSize: 14, color: 'var(--fg-3)' }}>Your account will need admin approval before you can sign in.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Username" hint="3–30 characters: letters, numbers, underscores" icon={
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }>
              <input
                type="text" value={form.username} onChange={e => set('username', e.target.value)}
                placeholder="jane_smith" autoComplete="username"
                pattern="[a-zA-Z0-9_]{3,30}" required
                style={inputStyle} onFocus={focusStyle} onBlur={blurStyle}
              />
            </Field>

            <Field label="Full name" icon={
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }>
              <input
                type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Jane Smith" required
                style={inputStyle} onFocus={focusStyle} onBlur={blurStyle}
              />
            </Field>

            <Field label="Password" icon={
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            }>
              <input
                type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="Min 8 characters" required
                style={{ ...inputStyle, paddingRight: 40 }} onFocus={focusStyle} onBlur={blurStyle}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', padding: 4 }}>
                {showPass
                  ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </Field>

            {/* Role selector */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 8 }}>Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[{ value: 'contributor', label: 'Contributor', desc: 'Complete work & earn rewards' }, { value: 'pm', label: 'Project Manager', desc: 'Create & manage projects' }].map(r => (
                  <button
                    key={r.value} type="button"
                    onClick={() => set('role', r.value)}
                    style={{
                      padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                      border: `2px solid ${form.role === r.value ? 'var(--kamel-blue)' : 'var(--border-2)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: form.role === r.value ? 'var(--kamel-blue-soft)' : 'var(--bg-1)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.role === r.value ? 'var(--kamel-blue)' : 'var(--fg-0)', marginBottom: 3 }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: form.role === r.value ? 'var(--kamel-blue)' : 'var(--fg-4)', lineHeight: 1.4, opacity: 0.85 }}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 13, color: '#B91C1C' }}>{error}</span>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '11px 0', marginTop: 4,
                background: loading ? 'var(--border-2)' : 'var(--gradient-brand)',
                color: loading ? 'var(--fg-3)' : '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em',
                boxShadow: loading ? 'none' : '0 1px 2px rgba(37,99,235,0.3), 0 4px 12px rgba(37,99,235,0.2)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.opacity = '0.92'; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--fg-3)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--kamel-blue)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
