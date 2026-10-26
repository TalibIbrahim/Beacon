// GET /api/config - Public settings the login screen needs before a session exists

import { Env } from '../_lib/types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return new Response(
    JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITEKEY || null }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
