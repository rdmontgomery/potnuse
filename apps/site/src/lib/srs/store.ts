import Dexie, { type EntityTable } from 'dexie';
import type { Card, CardId, ModuleId } from './schema';
import { dueAt, isDue } from './scheduler';

// Local-first SRS store. One IndexedDB database, one table, one row per
// card. We don't try to mirror this to a server in v0 — the curriculum is
// public and Rick's call is to skip auth for now. Multi-device sync gets
// bolted on later via Cloudflare D1 + a thin sync layer.

interface SrsDb extends Dexie {
  cards: EntityTable<Card, 'id'>;
}

const DB_NAME = 'rdm-curriculum-srs';

let _db: SrsDb | null = null;

function db(): SrsDb {
  if (_db) return _db;
  if (typeof indexedDB === 'undefined') {
    throw new Error('SRS store is browser-only — indexedDB not available');
  }
  const instance = new Dexie(DB_NAME) as SrsDb;
  instance.version(1).stores({
    // id is the primary key; moduleId secondary so /practice can find a
    // module's cards without scanning the whole table.
    cards: 'id, moduleId',
  });
  _db = instance;
  return instance;
}

export async function getCard(id: CardId): Promise<Card | undefined> {
  return db().cards.get(id);
}

export async function upsertCard(card: Card): Promise<void> {
  await db().cards.put(card);
}

export async function getModuleCards(moduleId: ModuleId): Promise<Card[]> {
  return db().cards.where('moduleId').equals(moduleId).toArray();
}

export async function getAllCards(): Promise<Card[]> {
  return db().cards.toArray();
}

export async function getDueCards(now: Date = new Date()): Promise<Card[]> {
  // Dexie can't index a nested Date directly, so we scan + filter. With v0's
  // ~2 cards per module × 12 modules = ~24 rows max, this is fine.
  const all = await getAllCards();
  return all
    .filter((c) => isDue(c.scheduling, now))
    .sort(
      (a, b) =>
        dueAt(a.scheduling).getTime() - dueAt(b.scheduling).getTime(),
    );
}

// ?demo-srs query param: shift the comparison clock forward by 24h so cards
// scheduled "tomorrow" become due "now". Used to simulate a return visit
// without waiting an actual day.
export function effectiveNow(): Date {
  if (typeof window === 'undefined') return new Date();
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo-srs') === null) return new Date();
  // Default skew: 24 hours. Override with ?demo-srs=Nh or ?demo-srs=Nd.
  const value = params.get('demo-srs');
  let hours = 24;
  if (value) {
    const m = value.match(/^(\d+(?:\.\d+)?)\s*(h|d)?$/);
    if (m) {
      const n = parseFloat(m[1]);
      hours = m[2] === 'd' ? n * 24 : m[2] === 'h' ? n : n;
    }
  }
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// Clear everything. Useful in the browser console while developing; also
// what /practice will offer behind a confirmation if we wire up a reset.
export async function clearAll(): Promise<void> {
  await db().cards.clear();
}
