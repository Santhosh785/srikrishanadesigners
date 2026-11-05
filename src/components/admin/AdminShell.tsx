// Owner-only shell shared by every admin page (dresses, quotes).
// Renders nothing but a spinner until a Supabase session is confirmed;
// without one it sends the visitor to the /admin/ login page.
import { useEffect, useState, type ReactNode } from 'react';
import { getAdminClient } from './supabase-admin';

const NAV = [
  { href: '/admin/dresses/', label: 'Dresses' },
  { href: '/admin/quotes/', label: 'Quotes' },
];

export type AdminShellProps = {
  children: ReactNode;
  /** Optional page heading shown under the nav. */
  title?: string;
};

export function AdminShell({ children, title }: AdminShellProps) {
  const supabase = getAdminClient();
  const [state, setState] = useState<'checking' | 'ready' | 'unconfigured'>('checking');
  const [email, setEmail] = useState('');
  const [path, setPath] = useState('');

  useEffect(() => {
    setPath(window.location.pathname);
    if (!supabase) {
      setState('unconfigured');
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        window.location.replace('/admin/');
        return;
      }
      setEmail(data.session.user.email ?? '');
      setState('ready');
    });
    // Signing out in another tab (or the session expiring) also leaves the admin.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.replace('/admin/');
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    try {
      await supabase?.auth.signOut();
    } finally {
      window.location.replace('/admin/');
    }
  }

  if (state === 'unconfigured') {
    return (
      <div className="adm-center">
        <p className="adm-error">Supabase is not configured (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY).</p>
      </div>
    );
  }
  if (state === 'checking') {
    return (
      <div className="adm-center" aria-busy="true">
        <span className="adm-spinner" role="status" aria-label="Checking sign-in" />
      </div>
    );
  }

  return (
    <div className="adm-shell">
      <header className="adm-bar">
        <a className="adm-brand" href="/admin/dresses/">SKD Admin</a>
        <nav className="adm-nav" aria-label="Admin">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} aria-current={path.startsWith(item.href) ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
          <button type="button" onClick={signOut} title={email ? `Signed in as ${email}` : undefined}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="adm-main">
        {title && <h1 className="adm-title">{title}</h1>}
        {children}
      </main>
    </div>
  );
}

export default AdminShell;
