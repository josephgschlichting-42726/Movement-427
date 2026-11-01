/**
 * Sync engine (plan §4): local-first, last-write-wins per row.
 *
 * push: every local row with updatedAt ≥ the last push watermark → push_records() RPC
 *       (the server only accepts a row if it's at least as new as what it has).
 * pull: every server row with server_updated_at > cursor (minus a small overlap) →
 *       written locally only if newer than the local copy.
 *
 * First sign-in on a device:
 *   - account empty            → upload everything on this phone
 *   - account has data, phone has none of its own → this phone adopts the account
 *     (local starter data is cleared first, so seeded types/workouts don't duplicate)
 *   - both have data           → merge (push + pull)
 */
import Dexie from 'dexie';
import { useEffect, useState } from 'react';
import { db } from '../db/schema';
import { supabase } from './client';

const TABLES = [
  'workoutTypes',
  'workouts',
  'plans',
  'planDays',
  'planSegments',
  'planBlocks',
  'planItems',
  'dailyCheckins',
  'sessions',
  'sessionBlocks',
  'sessionEntries',
  'sets',
  'timedDetails',
  'effortDetails',
] as const;
type TableName = (typeof TABLES)[number];

const PAGE = 500;
const OVERLAP_MS = 10_000; // re-read a little behind the cursor; applying is idempotent

// ---------- Status (tiny store + hook) ----------

export type SyncState = 'off' | 'signed-out' | 'idle' | 'syncing' | 'pending' | 'error' | 'offline';
export interface SyncStatus {
  state: SyncState;
  email?: string;
  lastSyncedAt?: number;
  message?: string;
}
let status: SyncStatus = { state: 'off' };
const listeners = new Set<(s: SyncStatus) => void>();
function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l(status));
}
export function useSyncStatus() {
  const [s, set] = useState(status);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return s;
}

// ---------- Per-user watermarks ----------

interface Meta {
  lastPush: number; // local updatedAt watermark
  cursor: string | null; // server_updated_at ISO
  initialized: boolean;
}
const metaKey = (uid: string) => `mov.sync.${uid}`;
function readMeta(uid: string): Meta {
  try {
    return { lastPush: 0, cursor: null, initialized: false, ...JSON.parse(localStorage.getItem(metaKey(uid)) ?? '{}') };
  } catch {
    return { lastPush: 0, cursor: null, initialized: false };
  }
}
function writeMeta(uid: string, m: Meta) {
  try {
    localStorage.setItem(metaKey(uid), JSON.stringify(m));
  } catch {
    /* storage blocked — we'll just re-sync more next time */
  }
}

// ---------- Core ----------

const table = (name: TableName) => db.table(name);

async function hasOwnLocalData() {
  // Seeded types/starter workouts don't count — only things the person made.
  for (const t of ['plans', 'sessions', 'dailyCheckins']) if ((await db.table(t).count()) > 0) return true;
  return false;
}

async function push(uid: string, meta: Meta) {
  const sb = supabase()!;
  let maxSeen = meta.lastPush;
  for (const name of TABLES) {
    const rows = await table(name).where('updatedAt').aboveOrEqual(meta.lastPush).toArray();
    for (let i = 0; i < rows.length; i += PAGE) {
      const batch = rows.slice(i, i + PAGE).map((r) => ({
        id: r.id,
        tbl: name,
        data: r,
        updated_at: r.updatedAt,
        deleted_at: r.deletedAt ?? null,
      }));
      const { error } = await sb.rpc('push_records', { rows: batch });
      if (error) throw error;
      for (const r of batch) maxSeen = Math.max(maxSeen, r.updated_at);
    }
  }
  meta.lastPush = maxSeen;
  writeMeta(uid, meta);
}

async function pull(uid: string, meta: Meta) {
  const sb = supabase()!;
  let cursor = meta.cursor;
  for (;;) {
    let q = sb.from('records').select('id, tbl, data, updated_at, server_updated_at').order('server_updated_at', { ascending: true }).limit(PAGE);
    if (cursor) q = q.gt('server_updated_at', new Date(Date.parse(cursor) - OVERLAP_MS).toISOString());
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    await db.transaction('rw', TABLES.map(table), async () => {
      for (const row of data) {
        if (!TABLES.includes(row.tbl as TableName)) continue;
        const t = table(row.tbl as TableName);
        const local = await t.get(row.id);
        // Strictly newer only: equal timestamps are the same version (and re-writing would loop syncs).
        if (!local || (local.updatedAt ?? 0) < row.updated_at) await t.put(row.data);
      }
    });
    const last = data[data.length - 1].server_updated_at as string;
    const advanced = !cursor || Date.parse(last) > Date.parse(cursor);
    cursor = last;
    meta.cursor = cursor;
    writeMeta(uid, meta);
    if (data.length < PAGE || !advanced) break;
  }
}

async function firstSync(uid: string, meta: Meta) {
  const sb = supabase()!;
  const { count, error } = await sb.from('records').select('id', { count: 'exact', head: true });
  if (error) throw error;
  const accountHasData = (count ?? 0) > 0;
  if (accountHasData && !(await hasOwnLocalData())) {
    // Adopt the account: clear this phone's seeded starter data so nothing duplicates.
    await db.transaction('rw', TABLES.map(table), async () => {
      for (const name of TABLES) await table(name).clear();
    });
    meta.lastPush = Date.now();
  }
  meta.initialized = true;
  writeMeta(uid, meta);
}

let running: Promise<void> | null = null;
let again = false;

/** Runs one push+pull cycle (coalesces overlapping calls). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      const sb = supabase();
      if (!sb) return setStatus({ state: 'off' });
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return setStatus({ state: 'signed-out', email: undefined });
      if (!navigator.onLine) return setStatus({ state: 'offline', email: user.email });
      setStatus({ state: 'syncing', email: user.email, message: undefined });
      const meta = readMeta(user.id);
      if (!meta.initialized) await firstSync(user.id, meta);
      await push(user.id, meta);
      await pull(user.id, meta);
      setStatus({ state: 'idle', lastSyncedAt: Date.now() });
    } catch (err) {
      console.error('sync failed', err);
      setStatus({ state: navigator.onLine ? 'error' : 'offline', message: err instanceof Error ? err.message : String(err) });
    } finally {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    }
  })();
  return running;
}

/** Wire up automatic syncing: on start, on reconnect, on return to the app, after edits, and every minute. */
export function startAutoSync() {
  const sb = supabase();
  if (!sb) return setStatus({ state: 'off' });
  let debounce = 0;
  Dexie.on('storagemutated', () => {
    if (status.state === 'signed-out' || status.state === 'off') return;
    if (status.state !== 'syncing') setStatus({ state: 'pending' });
    clearTimeout(debounce);
    debounce = window.setTimeout(() => void syncNow(), 2500);
  });
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => setStatus({ state: 'offline' }));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow());
  setInterval(() => document.visibilityState === 'visible' && void syncNow(), 60_000);
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void syncNow();
  });
  void syncNow();
}

// ---------- Auth ----------

export async function sendCode(email: string) {
  const sb = supabase();
  if (!sb) throw new Error('Sync is not configured yet.');
  // shouldCreateUser: false — testers are invited; random emails can't create accounts.
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string) {
  const sb = supabase();
  if (!sb) throw new Error('Sync is not configured yet.');
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  await syncNow();
}

/** Signing out stops syncing. Local data stays unless the person also chooses to remove it. */
export async function signOut(removeLocal: boolean) {
  const sb = supabase();
  if (sb) await sb.auth.signOut();
  if (removeLocal) {
    await db.transaction('rw', TABLES.map(table), async () => {
      for (const name of TABLES) await table(name).clear();
    });
  }
  setStatus({ state: 'signed-out', email: undefined });
}
