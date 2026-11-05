// /admin/quotes/ — the owner's inbox of dress quote requests.
// Mounted inside AdminShell, so it only runs once a session is confirmed.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QuoteRequest } from '../../lib/dress-types';
import { getAdminClient } from './supabase-admin';
import {
  CONTACT_TIME_LABELS,
  QUOTE_BUCKET,
  QUOTES_CHANGED_EVENT,
  SIGNED_URL_TTL,
  STATUS_LABELS,
  TABS,
  countByTab,
  isUuid,
  istDateTime,
  nextStatus,
  occasionDate,
  prevStatus,
  relativeTime,
  telLink,
  whatsappLink,
  type QuoteStatus,
  type QuoteTab,
  type QuotesChangedDetail,
} from './quote-admin';

type Row = QuoteRequest & { dresses: { slug: string } | null };

const SELECT =
  'id, dress_id, dress_name, name, phone, occasion_date, contact_time, message, photo_path, status, page, created_at, dresses(slug)';
const HIGHLIGHT_MS = 4000;

/** undefined = still signing, null = could not sign, string = signed URL. */
type PhotoUrls = Record<string, string | null | undefined>;

export default function QuoteInbox() {
  const supabase = getAdminClient()!;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<QuoteTab>('new');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<PhotoUrls>({});
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [missingId, setMissingId] = useState('');
  const [, setTick] = useState(0);
  const deepLinkDone = useRef(false);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const load = useCallback(async () => {
    setLoadError('');
    const { data, error: err } = await supabase
      .from('quote_requests')
      .select(SELECT)
      .order('created_at', { ascending: false });
    if (err) {
      setLoadError(`Could not load quote requests: ${err.message}`);
      return;
    }
    const list = (data ?? []) as unknown as Row[];
    setRows(list);

    const paths = [...new Set(list.map((r) => r.photo_path).filter((p): p is string => !!p))];
    if (!paths.length) return;
    setPhotos((prev) => Object.fromEntries(paths.map((p) => [p, prev[p]])));
    const { data: signed, error: signErr } = await supabase.storage
      .from(QUOTE_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    const next: PhotoUrls = Object.fromEntries(paths.map((p) => [p, null]));
    if (!signErr) for (const s of signed ?? []) if (s.path && s.signedUrl && !s.error) next[s.path] = s.signedUrl;
    setPhotos(next);
  }, [supabase]);

  useEffect(() => {
    load();
    // Keep "2 hours ago" honest while the page stays open.
    const timer = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => countByTab(rows ?? []), [rows]);
  const visible = useMemo(
    () => (rows ?? []).filter((r) => tab === 'all' || r.status === tab),
    [rows, tab],
  );

  // Tell the admin shell (nav badge) whenever the number of new requests changes.
  useEffect(() => {
    if (!rows) return;
    window.dispatchEvent(
      new CustomEvent<QuotesChangedDetail>(QUOTES_CHANGED_EVENT, { detail: { newCount: counts.new } }),
    );
  }, [rows, counts.new]);

  // Deep link from the WhatsApp alert: /admin/quotes/?id=<uuid>
  useEffect(() => {
    if (!rows || deepLinkDone.current) return;
    deepLinkDone.current = true;
    const id = new URLSearchParams(window.location.search).get('id')?.trim();
    if (!id) return;
    if (isUuid(id) && rows.some((r) => r.id === id.toLowerCase())) {
      setTab('all');
      setHighlightId(id.toLowerCase());
    } else {
      setMissingId(id);
    }
  }, [rows]);

  useEffect(() => {
    if (!highlightId) return;
    const el = cardRefs.current.get(highlightId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }
    const timer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  function setRowBusy(id: string, on: boolean) {
    setBusy((b) => {
      const next = { ...b };
      if (on) next[id] = true;
      else delete next[id];
      return next;
    });
  }

  async function changeStatus(row: Row, to: QuoteStatus) {
    setError('');
    setNotice('');
    setRowBusy(row.id, true);
    setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, status: to } : r)) ?? rs);
    const { data, error: err } = await supabase
      .from('quote_requests')
      .update({ status: to })
      .eq('id', row.id)
      .select('id');
    if (err || !data?.length) {
      setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, status: row.status } : r)) ?? rs);
      setError(`Could not update ${row.name}'s request: ${err?.message ?? 'no row was changed'}`);
    } else {
      setNotice(`${row.name}'s request moved to ${STATUS_LABELS[to]}.`);
    }
    setRowBusy(row.id, false);
  }

  /** Removes the reference photo; returns an error message, or '' when it is gone. */
  async function removePhoto(path: string): Promise<string> {
    const bucket = supabase.storage.from(QUOTE_BUCKET);
    const { data, error: err } = await bucket.remove([path]);
    if (err) return err.message;
    if (data?.length) return '';
    // Nothing was removed: either the object is already gone or storage refused silently.
    const slash = path.lastIndexOf('/');
    const file = path.slice(slash + 1);
    const { data: listed, error: listErr } = await bucket.list(slash > 0 ? path.slice(0, slash) : '', {
      search: file,
    });
    if (listErr) return listErr.message;
    return listed?.some((o) => o.name === file) ? 'storage did not allow the photo to be removed' : '';
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete ${row.name}'s request for "${row.dress_name}"? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    setRowBusy(row.id, true);
    if (row.photo_path) {
      const msg = await removePhoto(row.photo_path);
      if (msg) {
        setError(`Could not delete the reference photo, so the request was kept: ${msg}`);
        setRowBusy(row.id, false);
        return;
      }
    }
    const { data, error: err } = await supabase.from('quote_requests').delete().eq('id', row.id).select('id');
    if (err || !data?.length) {
      if (row.photo_path) {
        setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, photo_path: null } : r)) ?? rs);
      }
      setError(`Could not delete ${row.name}'s request: ${err?.message ?? 'no row was removed'}`);
      setRowBusy(row.id, false);
      return;
    }
    setRows((rs) => rs?.filter((r) => r.id !== row.id) ?? rs);
    setRowBusy(row.id, false);
    setNotice(`${row.name}'s request was deleted.`);
  }

  if (loadError && !rows) {
    return (
      <div className="adm-q-state">
        <p className="adm-error" role="alert">
          {loadError}
        </p>
        <button type="button" className="btn btn-outline" onClick={load}>
          Try again
        </button>
      </div>
    );
  }
  if (!rows) {
    return (
      <div aria-busy="true">
        <span className="adm-spinner" role="status" aria-label="Loading quote requests" />
      </div>
    );
  }

  return (
    <>
      <div className="adm-q-tabs" role="tablist" aria-label="Filter by status">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`adm-q-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="adm-q-panel"
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : STATUS_LABELS[t]}
            <span className="adm-q-count">{counts[t]}</span>
          </button>
        ))}
      </div>

      {missingId && (
        <p className="adm-q-note" role="status">
          Request not found. It may have been deleted.{' '}
          <button type="button" onClick={() => setMissingId('')}>
            Dismiss
          </button>
        </p>
      )}
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}
      {loadError && (
        <p className="adm-error" role="alert">
          {loadError}
        </p>
      )}
      <p className="adm-q-live" aria-live="polite">
        {notice}
      </p>

      <section id="adm-q-panel" role="tabpanel" aria-labelledby={`adm-q-tab-${tab}`}>
        {visible.length === 0 ? (
          <p className="adm-empty adm-q-empty">
            {rows.length === 0
              ? 'No quote requests yet. They appear here as soon as a customer sends one.'
              : tab === 'all'
                ? 'No quote requests.'
                : `No ${STATUS_LABELS[tab].toLowerCase()} requests.`}
          </p>
        ) : (
          <ul className="adm-q-list">
            {visible.map((row) => {
              const back = prevStatus(row.status);
              const fwd = nextStatus(row.status);
              const isBusy = !!busy[row.id];
              const slug = row.dress_id ? row.dresses?.slug : undefined;
              const photoUrl = row.photo_path ? photos[row.photo_path] : undefined;
              return (
                <li
                  key={row.id}
                  id={`quote-${row.id}`}
                  className="adm-q-card"
                  data-status={row.status}
                  data-highlight={highlightId === row.id ? 'true' : undefined}
                  tabIndex={-1}
                  ref={(el) => {
                    if (el) cardRefs.current.set(row.id, el);
                    else cardRefs.current.delete(row.id);
                  }}
                >
                  <div className="adm-q-head">
                    <div className="adm-q-who">
                      <strong>{row.name}</strong>
                      <a href={telLink(row.phone)} className="adm-q-phone">
                        {row.phone}
                      </a>
                    </div>
                    <span className={`adm-q-status adm-q-status-${row.status}`}>{STATUS_LABELS[row.status]}</span>
                  </div>

                  <dl className="adm-q-meta">
                    <div>
                      <dt>Dress</dt>
                      <dd>
                        {slug ? (
                          <a href={`/dresses/${slug}/`} target="_blank" rel="noopener">
                            {row.dress_name}
                          </a>
                        ) : (
                          <span>
                            {row.dress_name}
                            {!row.dress_id && <em className="adm-q-gone"> (dress removed)</em>}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Occasion</dt>
                      <dd>{row.occasion_date ? occasionDate(row.occasion_date) : 'Not given'}</dd>
                    </div>
                    <div>
                      <dt>Call time</dt>
                      <dd>{row.contact_time ? CONTACT_TIME_LABELS[row.contact_time] : 'Not given'}</dd>
                    </div>
                    <div>
                      <dt>Received</dt>
                      <dd>
                        <time dateTime={row.created_at} title={istDateTime(row.created_at)}>
                          {relativeTime(row.created_at)}
                        </time>
                        <span className="adm-q-abs">{istDateTime(row.created_at)}</span>
                      </dd>
                    </div>
                  </dl>

                  {row.message && <p className="adm-q-message">{row.message}</p>}

                  {row.photo_path && (
                    <div className="adm-q-photo">
                      {photoUrl ? (
                        <button
                          type="button"
                          className="adm-q-thumb"
                          onClick={() => setLightbox({ url: photoUrl, alt: `Reference photo from ${row.name}` })}
                          aria-label={`Open reference photo from ${row.name}`}
                        >
                          <img
                            src={photoUrl}
                            alt=""
                            loading="lazy"
                            onError={() => setPhotos((p) => ({ ...p, [row.photo_path!]: null }))}
                          />
                        </button>
                      ) : photoUrl === null ? (
                        <span className="adm-q-thumb adm-q-thumb-failed" role="img" aria-label="Photo unavailable">
                          Photo unavailable
                        </span>
                      ) : (
                        <span className="adm-q-thumb adm-q-thumb-loading" aria-label="Loading photo" />
                      )}
                    </div>
                  )}

                  <div className="adm-q-actions">
                    <a
                      className="adm-q-btn adm-q-wa"
                      href={whatsappLink(row.phone, row.name, row.dress_name)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Reply on WhatsApp
                    </a>
                    <a className="adm-q-btn" href={telLink(row.phone)}>
                      Call
                    </a>
                  </div>
                  <div className="adm-q-actions">
                    {back && (
                      <button type="button" className="adm-q-btn" disabled={isBusy} onClick={() => changeStatus(row, back)}>
                        Back to {STATUS_LABELS[back].toLowerCase()}
                      </button>
                    )}
                    {fwd && (
                      <button
                        type="button"
                        className="adm-q-btn adm-q-primary"
                        disabled={isBusy}
                        onClick={() => changeStatus(row, fwd)}
                      >
                        Mark {STATUS_LABELS[fwd].toLowerCase()}
                      </button>
                    )}
                    <button type="button" className="adm-q-btn adm-q-danger" disabled={isBusy} onClick={() => remove(row)}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {lightbox && (
        <div
          className="adm-q-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
          onClick={(e) => e.target === e.currentTarget && setLightbox(null)}
        >
          <img src={lightbox.url} alt={lightbox.alt} />
          <div className="adm-q-lightbox-bar">
            <a className="adm-q-btn" href={lightbox.url} target="_blank" rel="noopener noreferrer">
              Open full size
            </a>
            <button type="button" className="adm-q-btn" autoFocus onClick={() => setLightbox(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
