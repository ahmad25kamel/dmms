import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { Button, Input, Select, FormField, Alert } from '../../components/ui';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'contributor' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form.username, form.name, form.password, form.role);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dmms-auth-page">
      <div className="dmms-auth-card">
        <div className="dmms-auth-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
            <path d="M9 12l3-4 3 4M9 16h6"/>
          </svg>
          <span>DM<strong>MS</strong></span>
        </div>
        <h2 style={{ marginBottom: 20 }}>Create account</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Username" hint="3–30 characters, letters, numbers, underscores only">
            <Input value={form.username} onChange={e => set('username', e.target.value)} placeholder="jane_smith" autoComplete="username" pattern="[a-zA-Z0-9_]{3,30}" required />
          </FormField>
          <FormField label="Full name">
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" required />
          </FormField>
          <FormField label="Password">
            <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" required />
          </FormField>
          <FormField label="Role">
            <Select value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="contributor">Contributor</option>
              <option value="pm">Project Manager</option>
            </Select>
          </FormField>
          {error && <Alert type="error">{error}</Alert>}
          <Button type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="meta" style={{ textAlign: 'center', marginTop: 16 }}>
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
