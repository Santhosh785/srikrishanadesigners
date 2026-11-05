// /admin/dresses/ — every dress (published or not) with quick actions.
import { useEffect, useMemo, useState } from 'react';
import type { Dress } from '../../lib/dress-types';
import { dressPhotoUrl } from '../../lib/dress-types';
import { CATEGORY_LABELS, removeDressFolder } from './dress-admin';
import { getAdminClient } from './supabase-admin';

type Row = Pick<Dress, 'id' | 'slug' | 'name' | 'category' | 'photos' | 'published' | 'sort' | 'created_at'>;

export default function DressList() {
  const supabase = getAdminClient()!;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('dresses')
      .select('id, slug, name, category, photos, published, sort, created_at')
      .order('sort', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(`Could not load dresses: ${err.message}`);
        else setRows((data ?? []) as Row[]);
      });
  }, [supabase]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows) return [];
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  async function togglePublished(row: Row) {
    const next = !row.published;
    setError('');
    setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, published: next } : r)) ?? rs);
    const { error: err } = await supabase.from('dresses').update({ published: next }).eq('id', row.id);
    if (err) {
      setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, published: row.published } : r)) ?? rs);
      setError(`Could not update "${row.name}": ${err.message}`);
    }
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete "${row.name}"? This removes the dress and all its photos.`)) return;
    setBusyId(row.id);
    setError('');
    const { error: err } = await supabase.from('dresses').delete().eq('id', row.id);
    if (err) {
      setError(`Could not delete "${row.name}": ${err.message}`);
      setBusyId(null);
      return;
    }
    setRows((rs) => rs?.filter((r) => r.id !== row.id) ?? rs);
    try {
      await removeDressFolder(supabase, row.id);
    } catch (e) {
      setError(`"${row.name}" was deleted but some photos could not be removed: ${(e as Error).message}`);
    }
    setBusyId(null);
  }

  return (
    <>
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search by name"
          aria-label="Search dresses by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <a className="btn btn-primary" href="/admin/dresses/new/">
          Add dress
        </a>
      </div>
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}
      {rows === null && !error && <span className="adm-spinner" role="status" aria-label="Loading dresses" />}
      {rows && rows.length === 0 && <p className="adm-empty">No dresses yet. Tap “Add dress” to upload the first one.</p>}
      {rows && rows.length > 0 && visible.length === 0 && <p className="adm-empty">No dress matches “{query}”.</p>}
      <ul className="adm-list">
        {visible.map((row) => {
          const cover = row.photos?.[0];
          const src = cover ? dressPhotoUrl(cover.thumb) : null;
          return (
            <li key={row.id} className="adm-row" data-slug={row.slug}>
              {src ? (
                <img className="adm-thumb" src={src} alt="" width={64} height={80} loading="lazy" />
              ) : (
                <span className="adm-thumb adm-thumb-empty" aria-hidden="true" />
              )}
              <div className="adm-row-text">
                <strong>{row.name}</strong>
                <span>{CATEGORY_LABELS[row.category] ?? row.category}</span>
              </div>
              <label className="adm-switch">
                <input
                  type="checkbox"
                  checked={row.published}
                  onChange={() => togglePublished(row)}
                  aria-label={`Published: ${row.name}`}
                />
                <span>{row.published ? 'Live' : 'Hidden'}</span>
              </label>
              <div className="adm-row-actions">
                <a className="adm-link-btn" href={`/admin/dresses/edit/?id=${row.id}`}>
                  Edit
                </a>
                <button
                  type="button"
                  className="adm-link-btn adm-danger"
                  onClick={() => remove(row)}
                  disabled={busyId === row.id}
                >
                  {busyId === row.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
