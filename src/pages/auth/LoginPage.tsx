import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { Button, Input, FormField, Alert } from '../../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
        <h2 style={{ marginBottom: 20 }}>Sign in</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Username">
            <Input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" autoComplete="username" required />
          </FormField>
          <FormField label="Password">
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </FormField>
          {error && <Alert type="error">{error}</Alert>}
          <Button type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="meta" style={{ textAlign: 'center', marginTop: 16 }}>
          Don't have an account?{' '}
          <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
