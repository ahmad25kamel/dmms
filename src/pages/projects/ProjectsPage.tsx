import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../../api';
import type { Project } from '../../types';
import { Card, Badge, Button, Modal, FormField, Input, Textarea, Spinner, EmptyState, ProgressBar, Alert, useToast } from '../../components/ui';
import { formatCurrency, formatDate, projectStatusColor } from '../../lib/statusColors';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    projectsApi.list().then(setProjects).finally(() => setLoading(false));
  }, []);

  async function handleCreate(data: { name: string; description: string; budget_total: number }) {
    try {
      const p = await projectsApi.create(data);
      setProjects(ps => [p, ...ps]);
      setShowCreate(false);
      toast('Project created successfully');
    } catch (err) {
      throw err;
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Projects</h1>
          <p className="dmms-page-sub">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project to get started." action={<Button onClick={() => setShowCreate(true)}>Create Project</Button>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map(p => (
            <Card key={p.id}>
              <div className="dmms-row-between" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <Link to={`/projects/${p.id}`} style={{ fontWeight: 600, fontSize: 15, color: 'var(--fg-0)' }}>{p.name}</Link>
                    <Badge color={projectStatusColor[p.status]}>{p.status}</Badge>
                  </div>
                  {p.description && <p className="body-sm" style={{ marginBottom: 10 }}>{p.description}</p>}
                  <ProgressBar value={p.budget_allocated} max={p.budget_total} />
                  <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                    <span className="meta">Total <strong style={{ color: 'var(--fg-1)' }}>{formatCurrency(p.budget_total)}</strong></span>
                    <span className="meta">Allocated <strong style={{ color: 'var(--fg-1)' }}>{formatCurrency(p.budget_allocated)}</strong></span>
                    <span className="meta">Saved <strong style={{ color: 'var(--emerald)' }}>{formatCurrency(p.budget_saved)}</strong></span>
                    <span className="meta">End {formatDate(p.end_date)}</span>
                  </div>
                </div>
                <Link to={`/projects/${p.id}/tree`} style={{ marginLeft: 12 }}>
                  <Button variant="secondary" size="sm">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                    Tree
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}

function CreateProjectModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (d: { name: string; description: string; budget_total: number }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), description, budget_total: parseFloat(budget) || 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Project" onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="create-project-form" disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create Project'}</Button>
      </div>
    }>
      <form id="create-project-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <Alert type="error">{error}</Alert>}
        <FormField label="Project name">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Platform Redesign" required />
        </FormField>
        <FormField label="Description">
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this project about?" rows={3} />
        </FormField>
        <FormField label="Total Budget ($)">
          <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="50000" min="0" />
        </FormField>
      </form>
    </Modal>
  );
}
