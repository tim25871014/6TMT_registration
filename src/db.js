const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const usePostgres = process.env.USE_POSTGRES === 'true';

// -------- PostgreSQL implementation --------

let pool;

function getPool() {
  if (!pool) {
    const connectionString = String(process.env.DATABASE_URL || '').trim();

    const sslMode = process.env.PGSSLMODE || 'require';

    pool = new Pool({
      connectionString,
      ssl:
        sslMode === 'disable'
          ? false
          : {
              rejectUnauthorized: false
            }
    });
  }

  return pool;
}

async function initPostgresDb() {
  const client = await getPool().connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        osu_user_id BIGINT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        discord_id TEXT,
        global_rank_osu INTEGER,
        country TEXT,
        registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      `ALTER TABLE participants ADD COLUMN IF NOT EXISTS global_rank_osu INTEGER;`
    );
    await client.query(
      `ALTER TABLE participants ADD COLUMN IF NOT EXISTS discord_id TEXT;`
    );
    await client.query(
      `ALTER TABLE participants ADD COLUMN IF NOT EXISTS country TEXT;`
    );
  } finally {
    client.release();
  }
}

async function saveOrUpdateParticipantPostgres(user) {
  const poolInstance = getPool();

  await poolInstance.query(
    `
      INSERT INTO participants (osu_user_id, username, discord_id, global_rank_osu, country)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (osu_user_id)
      DO UPDATE SET username = EXCLUDED.username,
                    discord_id = EXCLUDED.discord_id,
                    global_rank_osu = EXCLUDED.global_rank_osu,
                    country = EXCLUDED.country;
    `,
    [
      user.id,
      user.username,
      user.discord_id ?? null,
      user.global_rank_osu ?? null,
      user.country ?? null
    ]
  );
}

async function getAllParticipantsPostgres() {
  const poolInstance = getPool();
  const result = await poolInstance.query(
	`SELECT osu_user_id, username, discord_id, global_rank_osu, country, registered_at FROM participants ORDER BY registered_at DESC;`
  );
  return result.rows;
}

async function deleteParticipantPostgres(osuUserId) {
  const poolInstance = getPool();
  await poolInstance.query(`DELETE FROM participants WHERE osu_user_id = $1;`, [osuUserId]);
}

// -------- File-based implementation (for local/simple use) --------

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'participants.json');

async function initFileDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]), 'utf8');
  }
}

function readFileParticipants() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeFileParticipants(list) {
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf8');
}

async function saveOrUpdateParticipantFile(user) {
  const list = readFileParticipants();
  const index = list.findIndex((p) => String(p.osu_user_id) === String(user.id));

  if (index === -1) {
    list.push({
      osu_user_id: user.id,
      username: user.username,
      discord_id: user.discord_id ?? null,
      global_rank_osu: user.global_rank_osu ?? null,
      country: user.country ?? null,
      registered_at: new Date().toISOString()
    });
  } else {
    list[index].username = user.username;
    list[index].discord_id = user.discord_id ?? list[index].discord_id ?? null;
    list[index].global_rank_osu = user.global_rank_osu ?? null;
    list[index].country = user.country ?? list[index].country ?? null;
  }

  writeFileParticipants(list);
}

async function getAllParticipantsFile() {
  const list = readFileParticipants();
  // Sort newest first
  return list.sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at));
}

async function deleteParticipantFile(osuUserId) {
  const list = readFileParticipants();
  const filtered = list.filter((p) => String(p.osu_user_id) !== String(osuUserId));
  writeFileParticipants(filtered);
}

// -------- Public API --------

async function initDb() {
  if (!usePostgres) {
    console.log('Using local JSON file database at', dataFile);
    await initFileDb();
  } else {
    console.log('Using PostgreSQL database');
    await initPostgresDb();
  }
}

async function saveOrUpdateParticipant(user) {
  if (!usePostgres) {
    await saveOrUpdateParticipantFile(user);
  } else {
    await saveOrUpdateParticipantPostgres(user);
  }
}

async function getAllParticipants() {
  if (!usePostgres) {
    return getAllParticipantsFile();
  }
  return getAllParticipantsPostgres();
}

async function deleteParticipant(osuUserId) {
  if (!usePostgres) {
    return deleteParticipantFile(osuUserId);
  }
  return deleteParticipantPostgres(osuUserId);
}

module.exports = {
  initDb,
  saveOrUpdateParticipant,
  getAllParticipants,
  deleteParticipant
};
