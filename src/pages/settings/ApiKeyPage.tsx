import { useEffect, useState } from 'react';
import { apiKeyApi, type APIKeyInfo } from '../../api';
import { Spinner } from '../../components/ui';

type State =
  | { phase: 'loading' }
  | { phase: 'no_key' }
  | { phase: 'has_key'; prefix: string }
  | { phase: 'revealed'; key: string; prefix: string };

export function ApiKeyPage() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    apiKeyApi.info()
      .then((info: APIKeyInfo) => {
        setState(info.has_key ? { phase: 'has_key', prefix: info.prefix } : { phase: 'no_key' });
      })
      .catch(() => setState({ phase: 'no_key' }));
  }, []);

  async function handleGenerate() {
    setIsWorking(true);
    setError(null);
    try {
      const { key } = await apiKeyApi.generate();
      const prefix = key.slice(0, 13);
      setState({ phase: 'revealed', key, prefix });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate API key');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRevoke() {
    setIsWorking(true);
    setError(null);
    try {
      await apiKeyApi.revoke();
      setState({ phase: 'no_key' });
      setConfirmRevoke(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to revoke API key');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCopy(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (state.phase === 'loading') return <Spinner />;

  const currentPrefix = state.phase === 'has_key' ? state.prefix
    : state.phase === 'revealed' ? state.prefix
    : null;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>API Key</h1>
          <p className="dmms-page-sub">Permanent key for MCP and automation — never expires unless revoked</p>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        {error && (
          <div style={{ background: 'var(--bg-danger, #fff0f0)', border: '1px solid var(--danger, #e53e3e)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20, color: 'var(--danger, #e53e3e)', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Status card */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: currentPrefix ? 'var(--emerald, #10b981)' : 'var(--fg-4, #ccc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {currentPrefix ? 'Active API Key' : 'No API Key'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                {currentPrefix
                  ? 'Your MCP server can use this key to authenticate permanently'
                  : 'Generate a key to use with the MCP server'}
              </div>
            </div>
          </div>

          {currentPrefix && (
            <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <span style={{ color: 'var(--fg-3)', marginRight: 8 }}>Prefix:</span>
              <code data-testid="api-key-prefix" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                {currentPrefix}••••••••••••••••••••••••••••••••••
              </code>
            </div>
          )}

          {state.phase === 'revealed' && (
            <div style={{ background: 'var(--bg-0)', border: '1px solid var(--emerald, #10b981)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--emerald, #10b981)', fontWeight: 600, marginBottom: 8 }}>
                Copy now — this key will not be shown again
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <code data-testid="api-key-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1, wordBreak: 'break-all' }}>
                  {state.key}
                </code>
                <button
                  onClick={() => handleCopy(state.key)}
                  style={{ flexShrink: 0, padding: '6px 12px', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-1)', cursor: 'pointer', fontSize: 12 }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {state.phase === 'no_key' && (
              <button className="dmms-btn dmms-btn-primary" onClick={handleGenerate} disabled={isWorking}>
                {isWorking ? 'Generating…' : 'Generate API Key'}
              </button>
            )}
            {(state.phase === 'has_key' || state.phase === 'revealed') && (
              <>
                <button className="dmms-btn dmms-btn-primary" onClick={handleGenerate} disabled={isWorking}>
                  {isWorking ? 'Generating…' : 'Regenerate'}
                </button>
                {!confirmRevoke ? (
                  <button className="dmms-btn" onClick={() => setConfirmRevoke(true)} style={{ color: 'var(--danger, #e53e3e)', borderColor: 'var(--danger, #e53e3e)' }}>
                    Revoke
                  </button>
                ) : (
                  <>
                    <button className="dmms-btn" onClick={handleRevoke} disabled={isWorking} style={{ background: 'var(--danger, #e53e3e)', color: '#fff', border: 'none' }}>
                      {isWorking ? 'Revoking…' : 'Confirm'}
                    </button>
                    <button className="dmms-btn" onClick={() => setConfirmRevoke(false)}>
                      Cancel
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* MCP setup instructions */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '24px 28px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>MCP Server Setup</h2>
          <p style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 16, lineHeight: 1.6 }}>
            Configure your MCP server to use the API key instead of a session JWT. Edit <code style={{ fontFamily: 'var(--font-mono)' }}>.claude/settings.json</code>:
          </p>
          <pre style={{ background: 'var(--bg-0)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', overflowX: 'auto', lineHeight: 1.6 }}>
{`{
  "mcpServers": {
    "dmms": {
      "command": "node",
      "args": ["dist-mcp/index.js"],
      "env": {
        "DMMS_BASE_URL": "http://localhost:3005",
        "DMMS_TOKEN": "<your-api-key>"
      }
    }
  }
}`}
          </pre>
          <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 12 }}>
            The API key never expires. Revoke and regenerate if it is compromised.
          </p>
        </div>
      </div>
    </div>
  );
}
