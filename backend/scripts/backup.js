/**
 * Takes a consistent, point-in-time snapshot of the SQLite dev database using
 * VACUUM INTO (safe to run while the server is live and writing under WAL mode)
 * and prunes old snapshots so the backups folder doesn't grow unbounded.
 */
const path = require('path');
const fs = require('fs');
const knex = require('knex')(require('../knexfile').development);

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const KEEP_LAST = 50;

async function run() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `dev-${stamp}.sqlite3`);

  await knex.raw('VACUUM INTO ?', [dest]);
  console.log(`[backup] snapshot saved: ${dest}`);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sqlite3'))
    .sort();
  const excess = files.length - KEEP_LAST;
  if (excess > 0) {
    for (const f of files.slice(0, excess)) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
    console.log(`[backup] pruned ${excess} old snapshot(s)`);
  }

  await knex.destroy();
}

run().catch((err) => {
  console.error('[backup] failed:', err);
  process.exit(1);
});
