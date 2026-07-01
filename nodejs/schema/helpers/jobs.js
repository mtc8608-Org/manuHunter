// Nested-field resolvers for the jobs domain.
// Loaded lazily from types.js to keep Application → events / files hydration
// in one query for the detail panel.
const { pool } = require('../../db');

const EVENT_COLS = `id, application_id, event_type, detail,
  to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS occurred_at`;

// Files joined through application_files, exposing the metadata the UI needs to
// render a download link (the actual bytes come from GET /api/files/:id/download).
const FILE_COLS = `f.id, f.filename, f.mime_type, f.size, af.kind`;

async function fetchApplicationEvents(application) {
  const res = await pool.query(
    `SELECT ${EVENT_COLS} FROM application_events
     WHERE application_id = $1::uuid ORDER BY occurred_at DESC`,
    [application.id]
  );
  return res.rows;
}

async function fetchApplicationFiles(application) {
  const res = await pool.query(
    `SELECT ${FILE_COLS} FROM application_files af
     JOIN files f ON f.id = af.file_id
     WHERE af.application_id = $1::uuid
     ORDER BY af.kind`,
    [application.id]
  );
  return res.rows;
}

module.exports = { fetchApplicationEvents, fetchApplicationFiles };
