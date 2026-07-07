// CV compile + artifact routes.
// - POST /api/cv/:id/compile      — assemble the cvDocument tree to .tex, hand it
//                                   to the Python TeX Live service, stream the PDF
//                                   back (powers the live preview button).
// - POST /api/cv/:id/save-pdf     — compile, store the PDF in MinIO + files, and
//                                   record a cv_artifacts row (the "CVs I have" list).
// - GET  /api/cv/artifacts/:id/download — owner-scoped download of a stored PDF.
// - DELETE /api/cv/artifacts/:id  — owner-scoped delete; removes the MinIO object
//                                   and the files row (cascading application_files
//                                   and cv_artifacts via ON DELETE CASCADE FKs).
// All routes require a logged-in user and are scoped to the owner (admin sees all).
const express = require('express');
const axios   = require('axios');
const { randomUUID } = require('crypto');
const { pool, minioClient, BUCKET } = require('../../db');
const { assembleCvLatex } = require('../../schema/helpers/cvAssemble');

const router = express.Router();

const isAdmin = (req) => req.user?.tier === 'admin';

// Assert the caller may compile a cvDocument (owner, admin, or shared NULL-owned
// sample — the same read rule as the resolvers), and return its row.
const loadOwnedDocument = async (id, req) => {
  const res = await pool.query('SELECT * FROM cv_components WHERE id = $1::uuid', [id]);
  const row = res.rows[0];
  if (!row || row.type !== 'cvDocument') return { error: 404 };
  if (!isAdmin(req) && row.owner_id && row.owner_id !== req.user.id) return { error: 403 };
  return { row };
};

// Shared NULL-owned docs have no owner profile — render with the caller's.
const compileToPdf = async (docId, profileOwnerId) => {
  const latex = await assembleCvLatex(docId, profileOwnerId);
  const url = `http://${process.env.PYTHON_HOST}:${process.env.PYTHON_PORT}/latex/compile`;
  const { data } = await axios.post(
    url,
    { latex_source: latex, filename: 'cv.pdf' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(data);
};

// Turn an axios error from the Python service into a useful client error.
const compileErrorPayload = (err) => {
  const buf = err.response?.data;
  if (buf) {
    try {
      const parsed = JSON.parse(Buffer.from(buf).toString('utf-8'));
      return { status: err.response.status || 422, body: parsed };
    } catch (_) { /* not JSON */ }
  }
  return { status: 500, body: { error: err.message || 'Compilation failed' } };
};

// POST /api/cv/:id/compile
router.post('/cv/:id/compile', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { row, error } = await loadOwnedDocument(req.params.id, req);
  if (error) return res.status(error).json({ error: error === 404 ? 'CV not found' : 'Not authorised' });
  try {
    const pdf = await compileToPdf(row.id, row.owner_id ?? req.user.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${row.name}.pdf"`);
    res.send(pdf);
  } catch (err) {
    const { status, body } = compileErrorPayload(err);
    console.error('-> CV compile error:', body.error ?? err.message);
    res.status(status).json(body);
  }
});

// POST /api/cv/:id/save-pdf
router.post('/cv/:id/save-pdf', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { row, error } = await loadOwnedDocument(req.params.id, req);
  if (error) return res.status(error).json({ error: error === 404 ? 'CV not found' : 'Not authorised' });

  let pdf;
  try {
    pdf = await compileToPdf(row.id, row.owner_id ?? req.user.id);
  } catch (err) {
    const { status, body } = compileErrorPayload(err);
    console.error('-> CV save-pdf compile error:', body.error ?? err.message);
    return res.status(status).json(body);
  }

  const label = (req.body?.label ?? '').toString().trim() || row.name;
  // Downloadable filename derives from the user-entered label (strip path/FS-unsafe
  // chars); this is what Content-Disposition and the client download use.
  const safeName = (label.replace(/[\/\\?%*:|"<>\x00-\x1f]+/g, '').trim() || row.name);
  const filename = /\.pdf$/i.test(safeName) ? safeName : `${safeName}.pdf`;
  const key   = `${randomUUID()}-${filename}`;
  try {
    // Object first, then the files row, then the cv_artifacts row — rolling back
    // the object if a subsequent insert fails, so no dangling row or orphan object.
    await minioClient.putObject(BUCKET, key, pdf, pdf.length, { 'Content-Type': 'application/pdf' });
    let fileRow;
    try {
      const fileRes = await pool.query(
        `INSERT INTO files (bucket, key, filename, mime_type, size, description, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [BUCKET, key, filename, 'application/pdf', pdf.length, 'Generated CV', req.user.id]
      );
      fileRow = fileRes.rows[0];
    } catch (dbErr) {
      await minioClient.removeObject(BUCKET, key).catch(e => console.error('MinIO rollback failed:', e.message));
      throw dbErr;
    }

    let artifact;
    try {
      const artRes = await pool.query(
        `INSERT INTO cv_artifacts (cv_component_id, file_id, owner_id, label)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
         RETURNING id, cv_component_id, file_id, owner_id, label,
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
        [row.id, fileRow.id, req.user.id, label]
      );
      artifact = artRes.rows[0];
    } catch (artErr) {
      // Undo both the files row and the object so we never leave a partial artifact.
      await pool.query('DELETE FROM files WHERE id = $1::uuid', [fileRow.id]).catch(() => {});
      await minioClient.removeObject(BUCKET, key).catch(() => {});
      throw artErr;
    }

    res.json({ ...artifact, filename: fileRow.filename, mime_type: fileRow.mime_type, size: String(fileRow.size) });
  } catch (err) {
    console.error('-> CV save-pdf error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Resolve an artifact the caller owns (or admin), returning it joined to its file.
const loadOwnedArtifact = async (id, req) => {
  const res = await pool.query(
    `SELECT a.*, f.key AS file_key, f.filename, f.mime_type
     FROM cv_artifacts a JOIN files f ON a.file_id = f.id
     WHERE a.id = $1::uuid`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return { error: 404 };
  if (!isAdmin(req) && row.owner_id !== req.user.id) return { error: 403 };
  return { row };
};

// GET /api/cv/artifacts/:id/download
router.get('/cv/artifacts/:id/download', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { row, error } = await loadOwnedArtifact(req.params.id, req);
  if (error) return res.status(error).json({ error: error === 404 ? 'Artifact not found' : 'Not authorised' });
  try {
    if (row.mime_type) res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${row.filename}"`);
    const stream = await minioClient.getObject(BUCKET, row.file_key);
    stream.pipe(res);
  } catch (e) {
    console.error('-> CV artifact download error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/cv/artifacts/:id
// One authoritative destroy: remove the MinIO object, then delete the files row.
// Deleting the files row cascades cv_artifacts and application_files. An orphaned
// object is safer than a dangling row, so we still delete the row if removal fails.
router.delete('/cv/artifacts/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { row, error } = await loadOwnedArtifact(req.params.id, req);
  if (error) return res.status(error).json({ error: error === 404 ? 'Artifact not found' : 'Not authorised' });
  try {
    await minioClient.removeObject(BUCKET, row.file_key)
      .catch(e => console.warn('-> MinIO object removal failed (deleting row anyway):', e.message));
    await pool.query('DELETE FROM files WHERE id = $1::uuid', [row.file_id]);
    res.json({ success: true });
  } catch (e) {
    console.error('-> CV artifact delete error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
