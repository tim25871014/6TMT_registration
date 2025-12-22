const querystring = require('querystring');

const OSU_AUTH_BASE = 'https://osu.ppy.sh/oauth/authorize';
const OSU_TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
const OSU_API_ME_URL = 'https://osu.ppy.sh/api/v2/me';
const OSU_API_USERS_URL = 'https://osu.ppy.sh/api/v2/users';

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAuthorizationUrl(state) {
  const clientId = ensureEnv('OSU_CLIENT_ID');
  const redirectUri = ensureEnv('OSU_REDIRECT_URI');

  const params = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify public'
  };

  if (state) {
    params.state = String(state);
  }

  const qs = querystring.stringify(params);
  return `${OSU_AUTH_BASE}?${qs}`;
}

async function exchangeCodeForToken(code) {
  const clientId = ensureEnv('OSU_CLIENT_ID');
  const clientSecret = ensureEnv('OSU_CLIENT_SECRET');
  const redirectUri = ensureEnv('OSU_REDIRECT_URI');

  const response = await fetch(OSU_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: Number(clientId),
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to exchange code for token: ${response.status} ${text}`);
  }

  return response.json();
}

async function fetchUserProfile(accessToken) {
  // 取得標準模式 (osu) 資訊，方便讀取該模式的全球排名
  const response = await fetch(`${OSU_API_ME_URL}/osu`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch osu user profile: ${response.status} ${text}`);
  }

  const data = await response.json();
  const globalRankOsu =
    data.statistics && typeof data.statistics.global_rank === 'number'
      ? data.statistics.global_rank
      : null;
  const country =
    (data.country_code && String(data.country_code)) ||
    (data.country && data.country.code && String(data.country.code)) ||
    null;

  return {
    id: data.id,
    username: data.username,
    global_rank_osu: globalRankOsu,
    country
  };
}

// --- Helpers for admin to look up a user by id (server-to-server) ---

let cachedAppToken = null;
let cachedAppTokenExpiresAt = 0;

async function getAppAccessToken() {
  const now = Date.now();
  if (cachedAppToken && now < cachedAppTokenExpiresAt - 60_000) {
    return cachedAppToken;
  }

  const clientId = ensureEnv('OSU_CLIENT_ID');
  const clientSecret = ensureEnv('OSU_CLIENT_SECRET');

  const response = await fetch(OSU_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: Number(clientId),
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'public'
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to get app access token: ${response.status} ${text}`);
  }

  const data = await response.json();
  cachedAppToken = data.access_token;
  const expiresInMs = typeof data.expires_in === 'number' ? data.expires_in * 1000 : 3600_000;
  cachedAppTokenExpiresAt = now + expiresInMs;
  return cachedAppToken;
}

async function fetchUserProfileById(osuUserId) {
  const token = await getAppAccessToken();
  const response = await fetch(`${OSU_API_USERS_URL}/${osuUserId}/osu`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch osu user by id: ${response.status} ${text}`);
  }

  const data = await response.json();
  const globalRankOsu =
    data.statistics && typeof data.statistics.global_rank === 'number'
      ? data.statistics.global_rank
      : null;
  const country =
    (data.country_code && String(data.country_code)) ||
    (data.country && data.country.code && String(data.country.code)) ||
    null;

  return {
    id: data.id,
    username: data.username,
    global_rank_osu: globalRankOsu,
    country
  };
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForToken,
  fetchUserProfile,
  fetchUserProfileById
};
