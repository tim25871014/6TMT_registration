require('dotenv').config();

const express = require('express');
const path = require('path');

const {
  getAuthorizationUrl,
  exchangeCodeForToken,
  fetchUserProfile,
  fetchUserProfileById
} = require('./osuAuth');
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

function escapeCsv(value) {
  const safe = value == null ? '' : String(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

function buildParticipantsCsv(participants) {
  const headers = [
    'osu_user_id',
    'username',
    'country',
    'discord_id',
    'global_rank_osu',
    'registered_at'
  ];

  const rows = participants.map((p) => {
    return [
      p.osu_user_id,
      p.username,
      p.country || '',
      p.discord_id || '',
      p.global_rank_osu ?? '',
      p.registered_at || ''
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

app.get('/auth/osu', (req, res) => {
  try {
    const discordId = (req.query.discord_id || '').toString().trim();
    if (!discordId) {
      return res.status(400).send('Missing required discord_id.');
    }

    const authUrl = getAuthorizationUrl(discordId);
    res.redirect(authUrl);
  } catch (err) {
    console.error('Failed to create osu auth URL:', err);
    res.status(500).send('OAuth configuration error.');
  }
});

// Admin API: list all participants (公開只讀，不需要 Admin Token)
app.get('/api/admin/participants', async (req, res) => {
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
    const { osu_user_id, discord_id } = req.body || {};

    if (!osu_user_id) {
      return res.status(400).json({ error: 'osu_user_id is required' });
    }

    const userIdNum = Number(osu_user_id);
    if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
      return res.status(400).json({ error: 'osu_user_id must be a positive number' });
    }

    const profile = await fetchUserProfileById(userIdNum);
    if (!profile) {
      return res.status(404).json({ error: 'osu user not found' });
    }

    // 合併 discord_id
    await saveOrUpdateParticipant({ ...profile, discord_id: discord_id ?? null });
    res.status(201).json({ ok: true, user: { ...profile, discord_id: discord_id ?? null } });
  } catch (err) {
    console.error('Failed to add/update participant:', err);
    res.status(500).json({ error: 'Failed to add/update participant' });
  }
});

// Admin API: refresh all participants' username and global rank from osu API
app.post('/api/admin/participants/refresh-all', requireAdminToken, async (req, res) => {
  try {
    const participants = await getAllParticipants();
    let updated = 0;
    let failed = 0;
    for (const p of participants) {
      try {
        const profile = await fetchUserProfileById(p.osu_user_id);
        if (profile) {
          await saveOrUpdateParticipant(profile);
          updated += 1;
        } else {
          failed += 1;
        }
      } catch (e) {
        console.error('Failed to refresh participant', p.osu_user_id, e);
        failed += 1;
      }
    }

    res.json({ ok: true, updated, failed, total: participants.length });
  } catch (err) {
    console.error('Failed to refresh all participants:', err);
    res.status(500).json({ error: 'Failed to refresh participants' });
  }
});

// Admin API: export participants as CSV (requires Admin Token)
app.get('/api/admin/participants/export.csv', requireAdminToken, async (req, res) => {
  try {
    const participants = await getAllParticipants();
    const csv = '\uFEFF' + buildParticipantsCsv(participants);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Failed to export participants CSV:', err);
    res.status(500).json({ error: 'Failed to export participants CSV' });
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

// Register page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'register.html'));
});

// Public registration list page
app.get('/list', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'list.html'));
});

app.get('/auth/osu/callback', async (req, res) => {
  const code = req.query.code;
  const discordId = (req.query.state || '').toString().trim();

  if (!code) {
    return res.status(400).send('Missing authorization code from osu!.');
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    const user = await fetchUserProfile(tokenData.access_token);

    await saveOrUpdateParticipant({
      ...user,
      discord_id: discordId || null
    });

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
