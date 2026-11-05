// Add / edit a dress. Photos are resized and converted to WebP in the
// browser, uploaded to the `dresses` bucket, then the row is saved. Any file
// uploaded during a failed save is removed again so the bucket has no orphans.
import { useEffect, useRef, useState, type SubmitEvent, type KeyboardEvent } from 'react';
import type { Dress, DressCategory, DressPhoto } from '../../lib/dress-types';
import { dressPhotoUrl } from '../../lib/dress-types';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COLOUR_TAGS,
  MAX_DESCRIPTION,
  MAX_PHOTOS,
  MAX_TAGS,
  OCCASION_TAGS,
  addTags,
  processPhoto,
  removeFiles,
  uniqueSlug,
  type ProcessedPhoto,
} from './dress-admin';
import { DRESS_BUCKET, getAdminClient } from './supabase-admin';

type PhotoState = 'processing' | 'ready' | 'uploading' | 'done' | 'failed';

type PhotoItem = {
  key: string;
  /** Already stored photo (edit mode) or one uploaded by this save. */
  stored?: DressPhoto;
  processed?: ProcessedPhoto;
  preview: string;
  state: PhotoState;
  error?: string;
  fileName?: string;
};

const STATE_LABEL: Record<PhotoState, string> = {
  processing: 'Processing…',
  ready: 'Ready to upload',
  uploading: 'Uploading…',
  done: 'Saved',
  failed: 'Failed',
};

let keySeq = 0;
const nextKey = () => `p${++keySeq}`;

type Props = { mode: 'create' | 'edit' };

export default function DressForm({ mode }: Props) {
  const supabase = getAdminClient()!;
  const [dressId, setDressId] = useState<string>(() => (mode === 'create' ? crypto.randomUUID() : ''));
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing'>(mode === 'create' ? 'ready' : 'loading');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DressCategory>('designer-blouse-stitching');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [published, setPublished] = useState(true);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [originalPhotos, setOriginalPhotos] = useState<DressPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<Set<string>>(new Set());

  // Release preview blobs when leaving the page.
  useEffect(() => () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  useEffect(() => {
    if (mode !== 'edit') return;
    const id = new URLSearchParams(window.location.search).get('id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setLoadState('missing');
      return;
    }
    supabase
      .from('dresses')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadState('missing');
          return;
        }
        const d = data as Dress;
        setDressId(d.id);
        setSlug(d.slug);
        setName(d.name);
        setCategory(d.category);
        setDescription(d.description ?? '');
        setTags(d.tags ?? []);
        setPublished(d.published);
        setOriginalPhotos(d.photos ?? []);
        setPhotos(
          (d.photos ?? []).map((p) => ({ key: nextKey(), stored: p, preview: dressPhotoUrl(p.thumb) ?? '', state: 'done' })),
        );
        setLoadState('ready');
      });
  }, [mode, supabase]);

  const patchPhoto = (key: string, patch: Partial<PhotoItem>) =>
    setPhotos((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    setNotice(list.length > room ? `Only ${MAX_PHOTOS} photos are allowed; ${list.length - files.length} skipped.` : '');
    const items: PhotoItem[] = files.map((f) => ({ key: nextKey(), preview: '', state: 'processing', fileName: f.name }));
    setPhotos((ps) => [...ps, ...items]);
    items.forEach((item, i) => {
      processPhoto(files[i])
        .then((processed) => {
          const url = URL.createObjectURL(processed.thumb.blob);
          objectUrls.current.add(url);
          patchPhoto(item.key, { processed, preview: url, state: 'ready' });
        })
        .catch((e: Error) => patchPhoto(item.key, { state: 'failed', error: e.message }));
    });
    if (fileInput.current) fileInput.current.value = '';
  }

  function move(index: number, delta: number) {
    setPhotos((ps) => {
      const j = index + delta;
      if (j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function removePhoto(key: string) {
    setPhotos((ps) => {
      const p = ps.find((x) => x.key === key);
      if (p?.preview && objectUrls.current.has(p.preview)) {
        URL.revokeObjectURL(p.preview);
        objectUrls.current.delete(p.preview);
      }
      return ps.filter((x) => x.key !== key);
    });
  }

  function commitTagInput() {
    const parts = tagInput.split(',');
    setTags((t) => addTags(t, parts));
    setTagInput('');
  }

  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTagInput();
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags((t) => t.slice(0, -1));
    }
  }

  function toggleSuggestion(tag: string) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : addTags(t, [tag])));
  }

  function validate(finalTags: string[]): string[] {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Name is required.');
    if (!CATEGORIES.includes(category)) errs.push('Choose a category.');
    if (description.length > MAX_DESCRIPTION) errs.push(`Description must be ${MAX_DESCRIPTION} characters or fewer.`);
    if (finalTags.length > MAX_TAGS) errs.push(`Use at most ${MAX_TAGS} tags.`);
    if (finalTags.some((t) => t !== t.toLowerCase().trim())) errs.push('Tags must be lower-case.');
    if (photos.length < 1) errs.push('Add at least one photo.');
    if (photos.length > MAX_PHOTOS) errs.push(`Use at most ${MAX_PHOTOS} photos.`);
    if (photos.some((p) => p.state === 'processing')) errs.push('Wait for photos to finish processing.');
    if (photos.some((p) => p.state === 'failed' && !p.processed))
      errs.push('Remove the photos marked “Failed” before saving.');
    return errs;
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    // Pick up a tag typed but not yet confirmed with Enter.
    const finalTags = tagInput.trim() ? addTags(tags, tagInput.split(',')) : tags;
    if (finalTags !== tags) {
      setTags(finalTags);
      setTagInput('');
    }
    const errs = validate(finalTags);
    setErrors(errs);
    if (errs.length) return;

    setSaving(true);
    setNotice('');
    const uploadedThisAttempt: string[] = [];
    const stamp = Date.now();
    const order = [...photos];

    try {
      // 1. Upload new photos (in order; each gets a unique n).
      const stored: DressPhoto[] = [];
      for (let i = 0; i < order.length; i++) {
        const item = order[i];
        if (item.stored) {
          stored.push(item.stored);
          continue;
        }
        const pp = item.processed!;
        const n = `${stamp}-${i}`;
        const path = `${dressId}/${n}.${pp.full.ext}`;
        const thumb = `${dressId}/${n}-thumb.${pp.thumb.ext}`;
        patchPhoto(item.key, { state: 'uploading', error: undefined });
        const bucket = supabase.storage.from(DRESS_BUCKET);
        const opts = { cacheControl: '31536000', upsert: false };
        const r1 = await bucket.upload(path, pp.full.blob, { ...opts, contentType: pp.full.type });
        if (r1.error) {
          patchPhoto(item.key, { state: 'failed', error: r1.error.message });
          throw new Error(`Photo upload failed: ${r1.error.message}`);
        }
        uploadedThisAttempt.push(path);
        const r2 = await bucket.upload(thumb, pp.thumb.blob, { ...opts, contentType: pp.thumb.type });
        if (r2.error) {
          patchPhoto(item.key, { state: 'failed', error: r2.error.message });
          throw new Error(`Photo upload failed: ${r2.error.message}`);
        }
        uploadedThisAttempt.push(thumb);
        patchPhoto(item.key, { state: 'done' });
        stored.push({ path, thumb, w: pp.full.w, h: pp.full.h });
      }

      // 2. Save the row.
      const fields = {
        name: name.trim(),
        category,
        description: description.trim() || null,
        tags: finalTags,
        photos: stored,
        published,
      };
      if (mode === 'create') {
        let lastError: { message: string; code?: string } | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const newSlug = await uniqueSlug(supabase, fields.name);
          const { error } = await supabase.from('dresses').insert({ id: dressId, slug: newSlug, ...fields });
          lastError = error;
          // Another save grabbed the same slug in between: pick the next one.
          if (error?.code === '23505' && error.message.includes('slug')) continue;
          break;
        }
        if (lastError) throw new Error(`Could not save the dress: ${lastError.message}`);
      } else {
        const { error } = await supabase.from('dresses').update(fields).eq('id', dressId);
        if (error) throw new Error(`Could not save the dress: ${error.message}`);
        // 3. Only after the row no longer references them, delete removed photos.
        const kept = new Set(stored.map((p) => p.path));
        const gone = originalPhotos.filter((p) => !kept.has(p.path)).flatMap((p) => [p.path, p.thumb]);
        await removeFiles(supabase, gone);
      }
      window.location.assign('/admin/dresses/');
    } catch (err) {
      // No orphans: remove every file this attempt uploaded, and mark those
      // photos as not uploaded so a retry uploads them again.
      await removeFiles(supabase, uploadedThisAttempt);
      setPhotos((ps) => ps.map((p) => (p.processed ? { ...p, state: 'ready' } : p)));
      setErrors([(err as Error).message]);
      setSaving(false);
    }
  }

  if (loadState === 'loading') return <span className="adm-spinner" role="status" aria-label="Loading dress" />;
  if (loadState === 'missing')
    return (
      <p className="adm-error">
        Dress not found. <a href="/admin/dresses/">Back to dresses</a>
      </p>
    );

  const suggestionGroups = [
    { label: 'Occasion', tags: OCCASION_TAGS },
    { label: 'Colour', tags: COLOUR_TAGS },
  ];

  return (
    <form className="adm-form" onSubmit={onSubmit} noValidate>
      <p className="adm-back">
        <a href="/admin/dresses/">← All dresses</a>
      </p>
      <h1 className="adm-title">{mode === 'create' ? 'Add dress' : 'Edit dress'}</h1>

      <label className="adm-field">
        <span>Name *</span>
        <input type="text" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {mode === 'edit' && (
        <p className="adm-hint">
          Web address: <code>/dresses/{slug}/</code> (stays the same when the name changes)
        </p>
      )}

      <label className="adm-field">
        <span>Category *</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as DressCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="adm-field">
        <span>Description (optional)</span>
        <textarea
          rows={3}
          maxLength={MAX_DESCRIPTION}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
        />
        <small className="adm-counter" aria-live="polite">
          {description.length}/{MAX_DESCRIPTION}
        </small>
      </label>

      <fieldset className="adm-field adm-tags">
        <legend>
          Tags ({tags.length}/{MAX_TAGS})
        </legend>
        <div className="adm-chips">
          {tags.map((t) => (
            <span key={t} className="adm-chip">
              {t}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags((x) => x.filter((y) => y !== t))}>
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            aria-label="Add a tag"
            placeholder={tags.length >= MAX_TAGS ? 'Tag limit reached' : 'Type a tag, press Enter'}
            disabled={tags.length >= MAX_TAGS}
            value={tagInput}
            onChange={(e) => {
              const v = e.target.value;
              if (v.includes(',')) {
                setTags((t) => addTags(t, v.split(',').slice(0, -1)));
                setTagInput(v.split(',').pop() ?? '');
              } else setTagInput(v);
            }}
            onKeyDown={onTagKey}
            onBlur={() => tagInput.trim() && commitTagInput()}
          />
        </div>
        {suggestionGroups.map((g) => (
          <div key={g.label} className="adm-suggest">
            <span>{g.label}:</span>
            {g.tags.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tags.includes(t)}
                disabled={!tags.includes(t) && tags.length >= MAX_TAGS}
                onClick={() => toggleSuggestion(t)}
              >
                {t}
              </button>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset className="adm-field adm-photos">
        <legend>
          Photos * ({photos.length}/{MAX_PHOTOS}) — the first photo is the cover
        </legend>
        <ul className="adm-photo-grid">
          {photos.map((p, i) => (
            <li key={p.key} className="adm-photo" data-state={p.state}>
              {i === 0 && <span className="adm-cover-badge">Cover</span>}
              {p.preview ? <img src={p.preview} alt={`Photo ${i + 1}`} /> : <span className="adm-photo-blank" />}
              <span className="adm-photo-state" title={p.error}>
                {STATE_LABEL[p.state]}
                {p.error ? `: ${p.error}` : ''}
              </span>
              <div className="adm-photo-actions">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || saving} aria-label={`Move photo ${i + 1} left`}>
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === photos.length - 1 || saving}
                  aria-label={`Move photo ${i + 1} right`}
                >
                  →
                </button>
                <button type="button" onClick={() => removePhoto(p.key)} disabled={saving} aria-label={`Remove photo ${i + 1}`}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        {photos.length < MAX_PHOTOS && (
          <label className="btn btn-outline adm-file">
            Add photos
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              disabled={saving}
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        )}
      </fieldset>

      <label className="adm-switch adm-switch-lg">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        <span>Published (visible on the website)</span>
      </label>

      {notice && <p className="adm-hint">{notice}</p>}
      {errors.length > 0 && (
        <ul className="adm-error" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="adm-form-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : mode === 'create' ? 'Save dress' : 'Save changes'}
        </button>
        <a className="btn btn-outline" href="/admin/dresses/">
          Cancel
        </a>
      </div>
    </form>
  );
}
