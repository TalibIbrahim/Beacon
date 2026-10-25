// POST /api/logout - End session and clear cookie

import { buildClearCookieHeader } from '../_lib/auth';
import { Env } from '../_lib/types';

export const onRequestPost: PagesFunction<Env> = async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildClearCookieHeader(),
    },
  });
};
