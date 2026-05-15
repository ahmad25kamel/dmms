import React, { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, useState, useCallback, createContext, useContext } from 'react';

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  as?: 'button' | 'a';
  href?: string;
}

const variantClass: Record<BtnVariant, string> = {
  primary:   'dmms-btn-primary',
  secondary: 'dmms-btn-secondary',
  ghost:     'dmms-btn-ghost',
  danger:    'dmms-btn-danger',
};
const sizeClass: Record<BtnSize, string> = {
  sm: 'dmms-btn-sm',
  md: '',
  lg: 'dmms-btn-lg',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`dmms-btn ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`dmms-icon-btn ${className}`} {...props}>
      {children}
    </button>
  );
}

// ── Form elements ─────────────────────────────────────────────────────────────
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`dmms-input ${className}`} {...props} />;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => <textarea ref={ref} className={`dmms-textarea ${className}`} {...props} />
);
Textarea.displayName = 'Textarea';

export * from './MentionsTextarea';

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`dmms-select ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="dmms-label">{children}</label>;
}

export function FormField({ label, children, error, hint }: { label: string; children: ReactNode; error?: string; hint?: string }) {
  return (
    <div className="dmms-field">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>{hint}</p>}
      {error && <p style={{ fontSize: 11, color: 'var(--rose)', margin: 0 }}>{error}</p>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`dmms-card ${className}`}>{children}</div>;
}

// ── KPI stat card ─────────────────────────────────────────────────────────────
export function KpiCard({
  label, value, delta, deltaDir = 'neutral',
}: {
  label: string; value: string | number; delta?: string; deltaDir?: 'up' | 'down' | 'neutral';
}) {
  const dir = deltaDir === 'up' ? 'pos' : deltaDir === 'down' ? 'neg' : 'neu';
  const arrow = deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '';
  return (
    <div className="dmms-kpi">
      <div className="dmms-kpi-label">{label}</div>
      <div className="dmms-kpi-value">{value}</div>
      {delta && <div className={`dmms-kpi-delta ${dir}`}>{arrow} {delta}</div>}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'indigo' | 'purple';

export function Badge({ children, color = 'gray', dot = false }: { children: ReactNode; color?: BadgeColor; dot?: boolean }) {
  return (
    <span className={`dmms-badge dmms-badge-${color}`}>
      {dot && <span className="dmms-badge-dot" />}
      {children}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, subtitle, children, onClose, footer, size = 'md' }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; footer?: ReactNode; size?: 'md' | 'lg' | 'xl';
}) {
  return (
    <div className="dmms-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dmms-modal${size === 'lg' ? ' dmms-modal--lg' : size === 'xl' ? ' dmms-modal--xl' : ''}`}>
        <div className="dmms-modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '4px 0 0' }}>{subtitle}</p>}
          </div>
          <IconButton onClick={onClose} style={{ flexShrink: 0, marginTop: -2 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </IconButton>
        </div>
        <div className="dmms-modal-body">{children}</div>
        {footer && <div className="dmms-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return <div className="dmms-spinner"><div className="dmms-spinner-ring" /></div>;
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ title, description, action, icon }: {
  title: string; description?: string; action?: ReactNode; icon?: ReactNode;
}) {
  return (
    <div className="dmms-empty">
      <div className="dmms-empty-icon">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </div>
      <p className="dmms-empty-title">{title}</p>
      {description && <p className="dmms-empty-desc">{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color }: { value: number; max: number; color?: 'blue' | 'green' | 'yellow' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="dmms-progress">
      <div
        className={`dmms-progress-fill${color === 'green' ? ' green' : color === 'yellow' ? ' yellow' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', children }: { type?: 'info' | 'success' | 'warn' | 'error'; children: ReactNode }) {
  const cls = { info: 'dmms-alert-info', success: 'dmms-alert-success', warn: 'dmms-alert-warn', error: 'dmms-alert-error' }[type];
  return <div className={`dmms-alert ${cls}`}>{children}</div>;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }
interface ToastCtx { toast: (message: string, type?: Toast['type']) => void; }

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = 0;

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++nextId;
    setToasts(ts => [...ts, { id, message, type }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3500);
  }, []);

  const colors: Record<Toast['type'], string> = {
    success: '#22c55e',
    error: '#ef4444',
    info: 'var(--kamel-blue)',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: 'var(--surface-1)',
            border: `1px solid ${colors[t.type]}`,
            borderLeft: `4px solid ${colors[t.type]}`,
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            fontSize: 13,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 240,
            maxWidth: 380,
            animation: 'fadeIn 0.2s ease',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  return useContext(ToastContext);
}
