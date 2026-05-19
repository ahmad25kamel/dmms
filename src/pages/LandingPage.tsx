import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { icon: '🌳', title: 'Recursive Deliverable Trees',  desc: 'Break any project into unlimited depth of sub-deliverables, each with its own budget ceiling and acceptance criteria.' },
  { icon: '💬', title: 'Open Marketplace Bidding',    desc: 'Publish deliverables to an open marketplace. Contributors compete on price and timeline.' },
  { icon: '✅', title: 'Acceptance-Criteria Checklists', desc: 'Every deliverable ships with verifiable acceptance criteria so approvals are objective.' },
  { icon: '📋', title: 'Kanban Task Board',            desc: 'Cross-project task tracking in one view. Drag, assign, comment and attach files on every card.' },
  { icon: '💰', title: 'Automatic Reward Ledger',     desc: 'Approved submissions instantly log earnings to the contributor ledger. Budget savings are tracked automatically.' },
  { icon: '🕵️', title: 'Full Audit Trail',            desc: 'Every action is logged with actor, entity, and metadata. Complete accountability with no gaps.' },
];

const PM_FEATURES = [
  'Build recursive deliverable trees with budget ceilings',
  'Open deliverables for competitive bidding',
  'Review and accept contributor proposals',
  'Approve or request revisions on submitted work',
  'Track budget allocation and savings in real time',
  'Monitor all activity through the audit trail',
];

const CON_FEATURES = [
  'Browse the marketplace for open bid deliverables',
  'Submit proposals with your price and ETA',
  'Work with structured acceptance-criteria checklists',
  'Submit proofs via notes, files and pull-request links',
  'Earn automatic reward ledger entries on approval',
  'Manage tasks on the cross-project Kanban board',
];

const SCREENSHOTS = [
  { src: '/screenshots/dashboard.png',   label: 'Dashboard' },
  { src: '/screenshots/projects.png',    label: 'Projects' },
  { src: '/screenshots/kanban.png',      label: 'Kanban Board' },
  { src: '/screenshots/marketplace.png', label: 'Marketplace' },
];

/* ── Inline SVG logo (white variant for dark backgrounds) ── */
function LogoWhite({ height = 48 }: { height?: number }) {
  const w = height * (860 / 220);
  return (
    <img src="/logo-white.svg" alt="DMMS" height={height} width={w}
      style={{ display: 'block' }} />
  );
}
function LogoDark({ height = 48 }: { height?: number }) {
  const w = height * (860 / 220);
  return (
    <img src="/logo-dark.svg" alt="DMMS" height={height} width={w}
      style={{ display: 'block' }} />
  );
}

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-0)', color: 'var(--fg-1)', minHeight: '100vh' }}>

      {/* ── Top nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 60%, #3b82f6 100%)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        padding: '0 32px',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <LogoWhite height={36} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '7px 18px', borderRadius: 'var(--radius-md)',
              border: '1.5px solid rgba(255,255,255,0.45)',
              background: 'transparent', color: '#fff',
              fontSize: 13.5, fontWeight: 500, cursor: 'pointer', letterSpacing: '-0.01em',
            }}
          >Sign In</button>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '7px 20px', borderRadius: 'var(--radius-md)',
              border: 'none',
              background: '#fff', color: '#1e3a8a',
              fontSize: 13.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            }}
          >Get Started</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        background: 'linear-gradient(150deg, #1e3a8a 0%, #2563EB 55%, #3b82f6 100%)',
        padding: '96px 24px 80px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: -200, right: -160, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: -100, left: -80, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36, position: 'relative' }}>
          <LogoWhite height={68} />
        </div>

        <h1 style={{
          margin: '0 0 16px',
          fontSize: 'clamp(38px, 5vw, 60px)',
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
        }}>
          Structure. Bid. Deliver.
        </h1>
        <p style={{
          margin: '0 auto 40px',
          maxWidth: 580,
          fontSize: 18,
          color: 'rgba(255,255,255,0.78)',
          lineHeight: 1.65,
          fontWeight: 400,
        }}>
          Break complex projects into modular deliverables, let contributors bid on real scope, and track every reward automatically.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '14px 36px', borderRadius: 'var(--radius-md)',
              border: 'none', background: '#fff', color: '#1e3a8a',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >Get Started Free</button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '14px 32px', borderRadius: 'var(--radius-md)',
              border: '1.5px solid rgba(255,255,255,0.5)',
              background: 'transparent', color: '#fff',
              fontSize: 15, fontWeight: 500, cursor: 'pointer', letterSpacing: '-0.01em',
            }}
          >Sign In</button>
        </div>
      </section>

      {/* ── Two-role section ── */}
      <section style={{ padding: '72px 24px', maxWidth: 1080, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg-0)', marginBottom: 8 }}>
          Built for two roles. Optimised for one goal.
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 15.5, marginBottom: 48 }}>
          DMMS aligns project managers and contributors around structured, accountable deliverables.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* PM card */}
          <RoleCard
            icon="🗂"
            role="Project Manager"
            color="var(--kamel-blue)"
            colorSoft="var(--kamel-blue-soft)"
            features={PM_FEATURES}
            cta="Start as PM"
            onCta={() => navigate('/register')}
          />
          {/* Contributor card */}
          <RoleCard
            icon="🏗"
            role="Contributor"
            color="#059669"
            colorSoft="#D1FAE5"
            features={CON_FEATURES}
            cta="Join as Contributor"
            onCta={() => navigate('/register')}
          />
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section style={{ padding: '60px 24px 72px', background: 'var(--bg-2)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg-0)', marginBottom: 8 }}>
            Everything you need. Nothing you don't.
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 15.5, marginBottom: 48 }}>
            A complete platform for project delivery — from scoping to payment.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: 'var(--bg-1)',
                borderRadius: 'var(--radius-xl)',
                padding: '28px 26px',
                border: '1px solid var(--border-1)',
                boxShadow: 'var(--shadow-2)',
              }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--fg-0)', marginBottom: 8, letterSpacing: '-0.01em' }}>{f.title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--fg-3)', lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Screenshot strip ── */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg-0)', marginBottom: 8 }}>
            See it in action
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 15.5, marginBottom: 40 }}>
            A real tool built for real workflows.
          </p>
          <div style={{
            display: 'flex', gap: 20, overflowX: 'auto',
            scrollSnapType: 'x mandatory', paddingBottom: 16,
            scrollbarWidth: 'thin',
          }}>
            {SCREENSHOTS.map(s => (
              <div key={s.src} style={{
                flex: '0 0 auto', scrollSnapAlign: 'start',
                width: 'clamp(280px, 60vw, 720px)',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                border: '1px solid var(--border-1)',
                boxShadow: 'var(--shadow-3)',
                background: 'var(--bg-2)',
              }}>
                <img
                  src={s.src}
                  alt={s.label}
                  style={{ width: '100%', display: 'block', aspectRatio: '1440/900', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--fg-4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-4)', marginTop: 12 }}>
            Scroll to explore ›
          </p>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 100%)',
        padding: '64px 24px',
        textAlign: 'center',
      }}>
        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(24px, 3.5vw, 38px)', letterSpacing: '-0.02em', margin: '0 0 14px' }}>
          Ready to ship structured work?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, margin: '0 0 36px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          Set up your first project in minutes. No credit card required.
        </p>
        <button
          onClick={() => navigate('/register')}
          style={{
            padding: '15px 44px', borderRadius: 'var(--radius-md)',
            border: 'none', background: '#fff', color: '#1e3a8a',
            fontSize: 15.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >Create Your Account</button>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        padding: '32px 24px',
        background: 'var(--bg-1)',
        borderTop: '1px solid var(--border-1)',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <LogoDark height={28} />
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-4)' }}>
          DMMS · Deliverable Modular Management System · Built for teams that ship.
        </p>
      </footer>
    </div>
  );
}

function RoleCard({ icon, role, color, colorSoft, features, cta, onCta }: {
  icon: string;
  role: string;
  color: string;
  colorSoft: string;
  features: string[];
  cta: string;
  onCta: () => void;
}) {
  return (
    <div style={{
      background: 'var(--bg-1)',
      borderRadius: 'var(--radius-xl)',
      padding: '32px 28px',
      border: '1px solid var(--border-1)',
      boxShadow: 'var(--shadow-2)',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: colorSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, marginBottom: 16,
      }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 19, color: 'var(--fg-0)', letterSpacing: '-0.02em', marginBottom: 6 }}>{role}</div>
      <div style={{ width: 32, height: 3, borderRadius: 2, background: color, marginBottom: 20 }} />
      <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {features.map(f => (
          <li key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>
            <span style={{ color, flexShrink: 0, marginTop: 1 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onCta}
        style={{
          marginTop: 'auto',
          padding: '11px 24px', borderRadius: 'var(--radius-md)',
          border: `1.5px solid ${color}`,
          background: 'transparent', color: color,
          fontSize: 13.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em',
        }}
      >{cta}</button>
    </div>
  );
}
