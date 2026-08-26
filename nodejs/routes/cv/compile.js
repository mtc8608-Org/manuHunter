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
const { isAdmin } = require('../../schema/helpers/ownership');
// Same safe headers the framework download uses — never hand-roll a MinIO pipe
// (see lib/filestream.js); a local copy silently misses future hardening.
const { streamFile } = require('../../lib/filestream');

const router = express.Router();

// Assert the caller may compile a cvDocument (owner, admin, or shared NULL-owned
// sample — the same read rule as the resolvers), and return its row.
// One error for "missing" and "someone else's" alike — splitting them into
// 404-vs-403 turns the route into an existence oracle (see the no-existence-
// oracle rule in .claude/rules/backend-api.md and schema/helpers/ownership.js).
const NOT_FOUND_CV       = 'CV not found or not authorised';
const NOT_FOUND_ARTIFACT = 'Artifact not found or not authorised';

const loadOwnedDocument = async (id, req) => {
  const res = await pool.query('SELECT * FROM cv_components WHERE id = $1::uuid', [id]);
  const row = res.rows[0];
  if (!row || row.type !== 'cvDocument') return { error: 404 };
  if (!isAdmin(req) && row.owner_id && row.owner_id !== req.user.id) return { error: 404 };
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
//
// The `log` tail is ADMIN-ONLY. CV field content is raw LaTeX authored by any
// registered account, so a deliberately-failing compile can print whatever the
// interpreter read into that log — it is an exfiltration channel, not just a
// diagnostic. pdflatex is confined by openin_any=p (latex/routes.py), so this is
// defence in depth; ordinary users get the reason without the transcript.
const compileErrorPayload = (err, req) => {
  const buf = err.response?.data;
  if (buf) {
    try {
      const parsed = JSON.parse(Buffer.from(buf).toString('utf-8'));
      const body = isAdmin(req) ? parsed : { error: parsed.error || 'Compilation failed' };
      return { status: err.response.status || 422, body };
    } catch (_) { /* not JSON */ }
  }
  return { status: 500, body: { error: 'Compilation failed' } };
};

// POST /api/cv/:id/compile
router.post('/cv/:id/compile', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { row, error } = await loadOwnedDocument(req.params.id, req);
  if (error) return res.status(error).json({ error: NOT_FOUND_CV });
  try {
    const pdf = await compileToPdf(row.id, row.owner_id ?? req.user.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${row.name}.pdf"`);
    res.send(pdf);
  } catch (err) {
    const { status, body } = compileErrorPayload(err, req);
    console.error('-> CV compile error:', body.error ?? err.message);
    res.status(status).json(body);
  }
});

// POST /api/cv/:id/save-pdf
router.post('/cv/:id/save-pdf', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { row, error } = await loadOwnedDocument(req.params.id, req);
  if (error) return res.status(error).json({ error: NOT_FOUND_CV });

  let pdf;
  try {
    pdf = await compileToPdf(row.id, row.owner_id ?? req.user.id);
  } catch (err) {
    const { status, body } = compileErrorPayload(err, req);
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
    res.status(500).json({ error: 'Could not save the PDF' });
  }
});

// Resolve an artifact the caller owns (or admin), returning it joined to its file.
const loadOwnedArtifact = async (id, req) => {
  const res = await pool.query(
    `SELECT a.*, f.key AS file_key, f.bucket, f.filename, f.mime_type
     FROM cv_artifacts a JOIN files f ON a.file_id = f.id
     WHERE a.id = $1::uuid`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return { error: 404 };
  if (!isAdmin(req) && row.owner_id !== req.user.id) return { error: 404 };
  return { row };
};

// GET /api/cv/artifacts/:id/download
router.get('/cv/artifacts/:id/download', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { row, error } = await loadOwnedArtifact(req.params.id, req);
  if (error) return res.status(error).json({ error: NOT_FOUND_ARTIFACT });
  try {
    await streamFile({ ...row, key: row.file_key }, res);
  } catch (e) {
    console.error('-> CV artifact download error:', e.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

// DELETE /api/cv/artifacts/:id
// One authoritative destroy: remove the MinIO object, then delete the files row.
// Deleting the files row cascades cv_artifacts and application_files. An orphaned
// object is safer than a dangling row, so we still delete the row if removal fails.
router.delete('/cv/artifacts/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const { row, error } = await loadOwnedArtifact(req.params.id, req);
  if (error) return res.status(error).json({ error: NOT_FOUND_ARTIFACT });
  try {
    await minioClient.removeObject(BUCKET, row.file_key)
      .catch(e => console.warn('-> MinIO object removal failed (deleting row anyway):', e.message));
    await pool.query('DELETE FROM files WHERE id = $1::uuid', [row.file_id]);
    res.json({ success: true });
  } catch (e) {
    console.error('-> CV artifact delete error:', e.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
