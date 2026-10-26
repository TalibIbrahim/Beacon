// GET /api/session - Cheap session check. The middleware has already rejected
// missing or expired sessions with 401 by the time this runs.

import { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async () => {
  return new Response(JSON.stringify({ authenticated: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
