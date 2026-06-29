// Online level catalog backed by Supabase. ALL networking lives here — the rest
// of the app uses listLevels / getLevel / uploadLevel and never touches Supabase
// directly. See Documentation/online-levels-setup.md for the table + setup.

import { importLevelJson } from './storage.js';

// Public project config. The anon key is safe to ship client-side; the table's
// row-level-security policies gate what it can do (public read + insert only).
// Fill these in after creating the Supabase project (see the setup doc).
const SUPABASE_URL = 'https://hkukrtqlatbedhdfurye.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_J8hFFStLe3TgKg6ANfVFNw_X6M1IZgn';

let _clientPromise = null;

// Lazily create the Supabase client via a dynamic import (not a top-level
// import) so a CDN/network failure degrades gracefully: online features error
// out with a toast, but local play, the editor, and built-in levels keep
// working.
function _getClient() {
  if (!isConfigured()) {
    return Promise.reject(new Error('Online levels are not configured.'));
  }
  if (!_clientPromise) {
    _clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
      .catch((e) => {
        _clientPromise = null; // allow a retry on the next call
        throw e;
      });
  }
  return _clientPromise;
}

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// List catalog entries (without the heavy `data` blob). Optional filters:
//   author  — exact author match (drives the author drill-down)
//   search  — case-insensitive substring match on name OR author
// `author` takes precedence over `search` when both are given.
export async function listLevels({ search, author } = {}) {
  const client = await _getClient();
  let query = client
    .from('levels')
    .select('id, name, author, created_at, author_time_ms')
    .order('created_at', { ascending: false })
    .limit(200);

  if (author) {
    query = query.eq('author', author);
  } else if (search && search.trim()) {
    // `.or()` is comma-separated and `%` is the ilike wildcard, so strip both
    // from the user term to keep the filter well-formed.
    const term = search.trim().replace(/[%,]/g, ' ');
    query = query.or(`name.ilike.%${term}%,author.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Fetch one level incl. its `data` blob. Returns the catalog metadata plus a
// game-ready `level` object (validated + normalized to the current schema).
export async function getLevel(id) {
  const client = await _getClient();
  const { data, error } = await client
    .from('levels')
    .select('id, name, author, created_at, author_time_ms, data')
    .eq('id', id)
    .single();
  if (error) throw error;

  // Defend against malformed / stale-schema rows by running the same validator
  // used for clipboard imports.
  const level = importLevelJson(JSON.stringify(data.data));
  level.name = data.name || level.name;

  return {
    id: data.id,
    name: data.name,
    author: data.author,
    created_at: data.created_at,
    author_time_ms: data.author_time_ms,
    level,
  };
}

// Insert a new level. Returns { id, edit_token } — the caller stores edit_token
// locally for future ownership features (unused by the MVP).
export async function uploadLevel({ name, author, data, authorTimeMs }) {
  const client = await _getClient();
  // Persist only the canonical level fields; identity/metadata live in columns.
  const levelData = {
    splines: data.splines,
    startPosition: data.startPosition,
    goalPosition: data.goalPosition,
  };
  const { data: row, error } = await client
    .from('levels')
    .insert({
      name,
      author,
      data: levelData,
      author_time_ms: authorTimeMs != null ? Math.round(authorTimeMs) : null,
    })
    .select('id, edit_token')
    .single();
  if (error) throw error;
  return row;
}
