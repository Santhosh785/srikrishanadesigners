// /admin/ sign-in. Email + password only: sign-up is disabled in Supabase.
import { useEffect, useState, type SubmitEvent } from 'react';
import { getAdminClient } from './supabase-admin';

const AFTER_LOGIN = '/admin/dresses/';

export default function LoginForm() {
  const supabase = getAdminClient();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(AFTER_LOGIN);
      else setChecking(false);
    });
  }, [supabase]);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Wrong email or password. Please try again.'
          : `Could not sign in: ${err.message}`,
      );
      setBusy(false);
      return;
    }
    window.location.replace(AFTER_LOGIN);
  }

  if (!supabase) {
    return <p className="adm-error">Supabase is not configured (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY).</p>;
  }
  if (checking) {
    return <span className="adm-spinner" role="status" aria-label="Checking sign-in" />;
  }

  return (
    <form className="adm-card adm-login" onSubmit={onSubmit}>
      <h1 className="adm-title">Owner sign in</h1>
      <label className="adm-field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="adm-field">
        <span>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
