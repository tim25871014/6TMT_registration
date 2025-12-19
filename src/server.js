require('dotenv').config();

const express = require('express');
const path = require('path');

const { getAuthorizationUrl, exchangeCodeForToken, fetchUserProfile } = require('./osuAuth');
const { initDb, saveOrUpdateParticipant, getAllParticipants, deleteParticipant } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple helper for admin token check
function requireAdminToken(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    console.warn('ADMIN_TOKEN is not set; /api/admin endpoints are unprotected.');
    return next();
  }

  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');

  if (token && token === expected) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

app.get('/auth/osu', (req, res) => {
  try {
    const authUrl = getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (err) {
    console.error('Failed to create osu auth URL:', err);
    res.status(500).send('OAuth configuration error.');
  }
});

// Admin API: list all participants
app.get('/api/admin/participants', requireAdminToken, async (req, res) => {
  try {
    const participants = await getAllParticipants();
    res.json(participants);
  } catch (err) {
    console.error('Failed to fetch participants:', err);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Admin API: add or update a participant
app.post('/api/admin/participants', requireAdminToken, async (req, res) => {
  try {
    const { osu_user_id, username } = req.body || {};

    if (!osu_user_id || !username) {
      return res.status(400).json({ error: 'osu_user_id and username are required' });
    }

    const userIdNum = Number(osu_user_id);
    if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
      return res.status(400).json({ error: 'osu_user_id must be a positive number' });
    }

    await saveOrUpdateParticipant({ id: userIdNum, username: String(username) });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Failed to add/update participant:', err);
    res.status(500).json({ error: 'Failed to add/update participant' });
  }
});

// Admin API: delete a participant by osu_user_id
app.delete('/api/admin/participants/:osuUserId', requireAdminToken, async (req, res) => {
  try {
    const osuUserId = req.params.osuUserId;
    if (!osuUserId) {
      return res.status(400).json({ error: 'osuUserId is required' });
    }

    await deleteParticipant(osuUserId);
    res.status(204).end();
  } catch (err) {
    console.error('Failed to delete participant:', err);
    res.status(500).json({ error: 'Failed to delete participant' });
  }
});

// Admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('/auth/osu/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('Missing authorization code from osu!.');
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    const user = await fetchUserProfile(tokenData.access_token);

    await saveOrUpdateParticipant(user);

    res.send(
      `<h1>報名成功！</h1>` +
        `<p>感謝你的參加，<strong>${user.username}</strong>（ID: ${user.id}）。</p>` +
        `<p>你可以關閉此頁面。</p>`
    );
  } catch (err) {
    console.error('Error during osu OAuth callback:', err);
    res.status(500).send('Failed to complete osu! authorization.');
  }
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
