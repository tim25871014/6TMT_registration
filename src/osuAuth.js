const querystring = require('querystring');

const OSU_AUTH_BASE = 'https://osu.ppy.sh/oauth/authorize';
const OSU_TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
const OSU_API_ME_URL = 'https://osu.ppy.sh/api/v2/me';

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAuthorizationUrl() {
  const clientId = ensureEnv('OSU_CLIENT_ID');
  const redirectUri = ensureEnv('OSU_REDIRECT_URI');

  const params = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify public'
  };

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
  const response = await fetch(OSU_API_ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch osu user profile: ${response.status} ${text}`);
  }

  const data = await response.json();

  return {
    id: data.id,
    username: data.username
  };
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForToken,
  fetchUserProfile
};
