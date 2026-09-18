/**
 * Cloudflare Worker — CORS proxy for the DZ Manifest wallboard.
 *
 * Forwards a GET request to an allowlisted `?url=` target, passes the caller's
 * Authorization header through, handles the CORS preflight, and returns the
 * response with permissive CORS headers. This exists because the GoSkydive API
 * (dz.goskydive.com) sends no CORS headers of its own, so a browser can't read
 * it directly. Restricted to an allowlist so the public URL can't be abused as
 * a general-purpose open proxy.
 *
 * Burble dropzones use a second route, `?burble=<dz_id>`. Burble's public board
 * feed needs a session cookie (set by loading the board page) and a POST, which
 * a browser can't do cross-site, so the Worker does both and returns the JSON.
 *
 * Deploy:
 *   npx wrangler deploy
 *
 * Proxy URL for the wallboard Settings (keep the trailing ?url=):
 *   https://dz-manifest-proxy.<your-subdomain>.workers.dev/?url=
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400'
};

const ALLOWED_HOSTS = ['dz.goskydive.com', 'api.adsb.lol'];

// --- Burble public manifest board ---
const BURBLE_BASE = 'https://eu-displays.burblesoft.com/';
const BURBLE_UA = 'Mozilla/5.0 (compatible; DZManifestWallboard/1.0; +https://bennrule.github.io/dz-manifest)';
const BURBLE_CACHE_MS = 8000;      // share one upstream call between viewers
const burbleCookies = new Map();   // dz_id -> session cookie (best-effort, per isolate)
const burbleCache = new Map();     // dz_id -> { body, at }

async function burbleCookie(dzId, force) {
  if (!force && burbleCookies.has(dzId)) return burbleCookies.get(dzId);
  // The board answers 307 -> /jmp and binds the dropzone to the session cookie set
  // on that first response. Don't follow the redirect: a cookieless follow-up
  // lands on a 404 and hands back a fresh, unbound session instead.
  const res = await fetch(BURBLE_BASE + 'jmp?dz_id=' + dzId, { headers: { 'User-Agent': BURBLE_UA }, redirect: 'manual' });
  const m = (res.headers.get('set-cookie') || '').match(/burblesoft=[^;]+/);
  if (!m) throw new Error('no Burble session cookie');
  burbleCookies.set(dzId, m[0]);
  return m[0];
}

async function burbleLoads(dzId) {
  const hit = burbleCache.get(dzId);
  if (hit && Date.now() - hit.at < BURBLE_CACHE_MS) return hit.body;
  for (let attempt = 0; attempt < 2; attempt++) {
    const cookie = await burbleCookie(dzId, attempt > 0);
    const res = await fetch(BURBLE_BASE + 'ajax_dzm2_frontend_jumpermanifestpublic', {
      method: 'POST',
      headers: {
        'User-Agent': BURBLE_UA,
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: 'action=getLoads&dz_id=' + dzId
    });
    const body = await res.text();
    let ok = false;
    try { ok = JSON.parse(body).success === true; } catch (e) {}
    if (ok) {
      burbleCache.set(dzId, { body, at: Date.now() });
      return body;
    }
    // success:false usually means the session went stale -> new cookie, one retry
  }
  throw new Error('Burble feed refused the request');
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const burbleId = new URL(request.url).searchParams.get('burble');
    if (burbleId !== null) {
      if (!/^\d{1,6}$/.test(burbleId)) {
        return new Response('Invalid ?burble= id', { status: 400, headers: CORS_HEADERS });
      }
      try {
        const body = await burbleLoads(burbleId);
        return new Response(body, { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      } catch (err) {
        return new Response('Burble fetch failed: ' + err.message, { status: 502, headers: CORS_HEADERS });
      }
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: CORS_HEADERS });
    }

    let targetUrl;
    try { targetUrl = new URL(target); }
    catch (e) { return new Response('Invalid ?url=', { status: 400, headers: CORS_HEADERS }); }
    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: CORS_HEADERS });
    }

    // A descriptive User-Agent — some upstreams (e.g. adsb.lol) reject the
    // default/blank UA that Cloudflare Workers send and return 403 otherwise.
    const fwdHeaders = new Headers({
      'Accept': 'application/json',
      'User-Agent': 'DZManifestWallboard/1.0 (+https://bennrule.github.io/dz-manifest)'
    });
    const auth = request.headers.get('Authorization');
    if (auth) fwdHeaders.set('Authorization', auth);

    let originRes;
    try {
      originRes = await fetch(target, { method: 'GET', headers: fwdHeaders });
    } catch (err) {
      return new Response('Upstream fetch failed: ' + err.message, { status: 502, headers: CORS_HEADERS });
    }

    const headers = new Headers(originRes.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
    return new Response(originRes.body, {
      status: originRes.status,
      statusText: originRes.statusText,
      headers
    });
  }
};
