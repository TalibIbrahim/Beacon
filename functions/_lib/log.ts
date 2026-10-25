// Activity logging stored in Cloudflare KV capped at 100 entries

import { ActivityLogEntry } from './types';

const LOG_KEY = 'activity_log';
const MAX_LOG_CAP = 100;

export async function addActivityLog(
  kv: KVNamespace,
  entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>
): Promise<ActivityLogEntry> {
  const newEntry: ActivityLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  try {
    const existing = await kv.get<ActivityLogEntry[]>(LOG_KEY, 'json');
    const logList: ActivityLogEntry[] = Array.isArray(existing) ? existing : [];
    
    // Add newest at start, cap at MAX_LOG_CAP
    const updated = [newEntry, ...logList].slice(0, MAX_LOG_CAP);
    await kv.put(LOG_KEY, JSON.stringify(updated));
  } catch (err) {
    // If logging fails, do not throw to crash main request, but console error
    console.error('Failed to append activity log:', err);
  }

  return newEntry;
}

export async function getRecentActivityLog(
  kv: KVNamespace,
  limit = 20
): Promise<ActivityLogEntry[]> {
  try {
    const entries = await kv.get<ActivityLogEntry[]>(LOG_KEY, 'json');
    if (!Array.isArray(entries)) {
      return [];
    }
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}
