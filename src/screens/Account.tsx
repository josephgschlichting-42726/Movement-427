import { useState } from 'react';
import { ScreenHead } from '../components/ui';
import { syncConfigured } from '../config';
import { sendCode, signOut, syncNow, useSyncStatus, verifyCode, type SyncState } from '../sync/sync';

const STATE_LABEL: Record<SyncState, string> = {
  off: 'Not set up',
  'signed-out': 'Signed out',
  idle: 'Backed up',
  syncing: 'Syncing…',
  pending: 'Changes waiting',
  error: 'Sync problem',
  offline: 'Offline — will sync later',
};

export function syncPipClass(state: SyncState) {
  return state === 'idle' ? '' : state === 'error' ? 'err' : 'warn';
}

export function Account() {
  const status = useSyncStatus();
  const signedIn = !!status.email && status.state !== 'signed-out';

  return (
    <div className="screen">
      <ScreenHead title="Account" label="Backup & sync" back="/settings" />
      {!syncConfigured() ? (
        <p className="muted">Sync isn’t connected to a server yet. Everything still works and saves on this phone.</p>
      ) : signedIn ? (
        <SignedIn email={status.email!} />
      ) : (
        <SignIn />
      )}
      {syncConfigured() && (
        <p className="hint" style={{ marginTop: 'var(--space-6)' }}>
          moov saves to this phone first, so it works with no signal. When you’re signed in, changes back up automatically and
          your data is private to your account.
        </p>
      )}
    </div>
  );

  function SignedIn({ email }: { email: string }) {
    const [confirmOut, setConfirmOut] = useState(false);
    return (
      <div className="stack">
        <ul className="rows">
          <li className="row">
            <span className="row-text">
              <span className="row-sub">Signed in as</span>
              <span className="row-title">{email}</span>
            </span>
          </li>
          <li className="row">
            <span className="row-text">
              <span className="row-sub">Status</span>
              <span className="row-title">{STATE_LABEL[status.state]}</span>
              {status.lastSyncedAt && <span className="row-sub">Last synced {new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
              {status.state === 'error' && status.message && <span className="row-sub" style={{ color: 'var(--status-error)' }}>⚠ {status.message}</span>}
            </span>
            <span className={`pip ${syncPipClass(status.state)}`} aria-hidden />
          </li>
        </ul>
        <button className="btn btn-secondary btn-block" disabled={status.state === 'syncing'} onClick={() => syncNow()}>
          Sync now
        </button>
        {!confirmOut ? (
          <button className="link-btn danger" style={{ justifySelf: 'start' }} onClick={() => setConfirmOut(true)}>
            Sign out
          </button>
        ) : (
          <div className="panel stack">
            <p>Sign out of {email}?</p>
            <button className="btn btn-secondary btn-block" onClick={() => signOut(false)}>
              Sign out, keep data on this phone
            </button>
            <button className="btn btn-secondary btn-block" onClick={() => signOut(true)}>
              Sign out and remove data from this phone
            </button>
            <p className="hint">Your backed-up data stays safe in your account either way.</p>
            <button className="link-btn" style={{ justifySelf: 'start' }} onClick={() => setConfirmOut(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(/signups not allowed|not found|Signups/i.test(msg) ? 'That email hasn’t been invited yet. Ask whoever set up moov to invite you.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return !sent ? (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await sendCode(email.trim().toLowerCase());
          setSent(true);
        });
      }}
    >
      <p className="muted">Sign in to back up your data and keep it if you change phones. We’ll email you a code — no password.</p>
      <label className="field-row">
        <span className="label">Email</span>
        <input className="field" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </label>
      {err && <p className="err-msg">⚠ {err}</p>}
      <button className="btn btn-primary btn-block" disabled={busy || !email.includes('@')}>
        {busy ? 'Sending…' : 'Email me a code'}
      </button>
    </form>
  ) : (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await verifyCode(email.trim().toLowerCase(), code.trim());
        });
      }}
    >
      <p className="muted">
        Enter the code we sent to <b>{email}</b>. It can take a minute to arrive — check spam too.
      </p>
      <label className="field-row">
        <span className="label">Code</span>
        <input
          className="field field-num code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="123456"
          autoFocus
        />
      </label>
      {err && <p className="err-msg">⚠ {err}</p>}
      <button className="btn btn-primary btn-block" disabled={busy || code.length < 6}>
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      <button type="button" className="link-btn" style={{ justifySelf: 'start' }} onClick={() => (setSent(false), setCode(''), setErr(null))}>
        Use a different email
      </button>
    </form>
  );
}
