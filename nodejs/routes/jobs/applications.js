const express = require('express');
const { randomUUID } = require('crypto');
const { pool, minioClient, upload, BUCKET } = require('../../db');

const router = express.Router();

// Upload a tailored artifact (CV / cover / JD) and link it to an application in
// one call. Reuses the framework `files` table + MinIO so download works through
// the existing GET /api/files/:id/download route.
// Multipart: field `file` (required), body `kind` ('cv' | 'jd' | 'cover').
router.post('/applications/:id/files', upload.single('file'), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided' });
  const kind = ['cv', 'jd', 'cover'].includes(req.body?.kind) ? req.body.kind : 'cv';
  const applicationId = req.params.id;

  // Guard: application must exist and be visible to this user.
  const appRes = await pool.query('SELECT user_id FROM applications WHERE id = $1::uuid', [applicationId]);
  if (!appRes.rows.length) return res.status(404).json({ error: 'Application not found' });
  if (req.user.role !== 'admin' && appRes.rows[0].user_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorised for this application' });
  }

  const key = `${randomUUID()}-${file.originalname}`;
  try {
    await minioClient.putObject(BUCKET, key, file.buffer, file.size, { 'Content-Type': file.mimetype });
    let fileRow;
    try {
      const inserted = await pool.query(
        `INSERT INTO files (bucket, key, filename, mime_type, size, description, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [BUCKET, key, file.originalname, file.mimetype, file.size, `${kind} for application ${applicationId}`, req.user.id]
      );
      fileRow = inserted.rows[0];
    } catch (dbErr) {
      await minioClient.removeObject(BUCKET, key).catch(e => console.error('MinIO rollback failed:', e.message));
      if (dbErr.code === '23503' && dbErr.constraint === 'files_uploaded_by_fkey') {
        return res.status(401).json({ error: 'Session expired — please log in again' });
      }
      throw dbErr;
    }

    await pool.query(
      `INSERT INTO application_files (application_id, file_id, kind)
       VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (application_id, file_id) DO UPDATE SET kind = EXCLUDED.kind`,
      [applicationId, fileRow.id, kind]
    );

    res.json({ id: fileRow.id, filename: fileRow.filename, mime_type: fileRow.mime_type, size: fileRow.size, kind });
  } catch (e) {
    console.error('Application file upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
