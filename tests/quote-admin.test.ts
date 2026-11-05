// Tests for src/components/admin/quote-admin.ts (pure helpers of the quote inbox).
// Run: npx -y node@24 --test tests/quote-admin.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countByTab,
  nextStatus,
  prevStatus,
  relativeTime,
  telLink,
  waPhone,
  whatsappLink,
} from '../src/components/admin/quote-admin.ts';

test('waPhone prefixes 91 only for bare Indian numbers', () => {
  assert.equal(waPhone('9876543210'), '919876543210');
  assert.equal(waPhone('098765 43210'), '919876543210');
  assert.equal(waPhone('+91 98765-43210'), '919876543210');
  assert.equal(waPhone('+1 (415) 555-0100'), '14155550100');
});

test('whatsappLink encodes the prefilled text', () => {
  assert.equal(
    whatsappLink('98765 43210', 'Asha & Co', 'Red Lehenga'),
    'https://wa.me/919876543210?text=' +
      encodeURIComponent('Hi Asha & Co, this is Sri Krishna Designers about your quote for Red Lehenga'),
  );
});

test('telLink keeps a leading plus', () => {
  assert.equal(telLink('+91 98765 43210'), 'tel:+919876543210');
  assert.equal(telLink('044-2345 6789'), 'tel:04423456789');
});

test('status steps', () => {
  assert.equal(nextStatus('new'), 'contacted');
  assert.equal(nextStatus('done'), null);
  assert.equal(prevStatus('contacted'), 'new');
  assert.equal(prevStatus('new'), null);
});

test('countByTab', () => {
  const rows = [{ status: 'new' }, { status: 'new' }, { status: 'done' }] as const;
  assert.deepEqual(countByTab([...rows]), { new: 2, contacted: 0, done: 1, all: 3 });
});

test('relativeTime', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  assert.equal(relativeTime('2026-11-05T10:00:00Z', now), '2 hours ago');
  assert.equal(relativeTime('2026-11-05T11:59:50Z', now), 'just now');
  assert.equal(relativeTime('2026-11-04T12:00:00Z', now), 'yesterday');
});
