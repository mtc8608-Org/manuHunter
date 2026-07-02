require('dotenv').config();
const express  = require('express');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const cors     = require('cors');
const { pool, minioClient, BUCKET } = require('./db');
const { handler: graphqlHandler }   = require('./schema');

const PORT   = process.env.NODE_PORT;
const server = express();

server.use(express.json());
server.use(cors());

// ── JWT decode middleware ──────────────────────────────────────────────────────
// Runs on every request. Attaches req.user if token is present and valid.
// Always calls next() — public routes continue even without a token.
server.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    } catch (_) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
});

// ── Request logger ────────────────────────────────────────────────────────────
server.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const user = req.user?.id ?? 'anon';
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms user=${user}`);
  });
  next();
});

// ── GraphQL ───────────────────────────────────────────────────────────────────
server.all('/graphql', graphqlHandler);

// ── REST routes ───────────────────────────────────────────────────────────────
// [FRAMEWORK]
server.use('/api', require('./routes/framework/auth'));
server.use('/api', require('./routes/framework/files'));
server.use('/api', require('./routes/framework/content'));
server.use('/api', require('./routes/framework/compute'));

// [JOBS]
server.use('/api', require('./routes/jobs/applications'));

// [CV]
server.use('/api', require('./routes/cv/compile'));

// ── Startup ───────────────────────────────────────────────────────────────────
// Start listening immediately so the container is healthy, then seed the admin
// user in the background with retries (postgres may not be ready yet).

server.listen(PORT, () => console.log('Server running on PORT http://localhost:' + PORT));

if (!/^[0-9a-fA-F]{64}$/.test(process.env.SECRETS_MASTER_KEY ?? '')) {
  console.warn('-> SECRETS_MASTER_KEY missing or not 64 hex chars — the user_secrets keychain is disabled (generate one with `openssl rand -hex 32` and add it to .env)');
}

(async () => {
  const MAX = 15;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      const count = await pool.query('SELECT COUNT(*) FROM users');
      if (parseInt(count.rows[0].count, 10) === 0) {
        const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        await pool.query(
          'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
          [process.env.ADMIN_EMAIL, hash, 'admin']
        );
        console.log('-> Admin user seeded:', process.env.ADMIN_EMAIL);
      } else {
        console.log('-> Users table already populated, skipping seed');
      }

      // ── CV seed ownership ─────────────────────────────────────────────────
      // The sample CV library + documents are seeded with owner_id NULL because
      // the admin row does not exist when init scripts run on a fresh volume.
      // Claim every non-template CV node for the admin so it is not globally
      // visible (the default cvTemplate stays NULL → shared with all users).
      // Idempotent: users never create NULL-owned nodes, so this only ever
      // matches the untouched seeds.
      try {
        const adminRes = await pool.query('SELECT id FROM users WHERE email = $1', [process.env.ADMIN_EMAIL]);
        const adminId  = adminRes.rows[0]?.id;
        if (adminId) {
          const stamped = await pool.query(
            `UPDATE cv_components SET owner_id = $1 WHERE owner_id IS NULL AND type <> 'cvTemplate'`,
            [adminId]
          );
          if (stamped.rowCount) console.log(`-> Stamped ${stamped.rowCount} seed CV node(s) to admin`);
          // Same claim for the seed identity profile (owner_id NULL until now).
          const prof = await pool.query(
            `UPDATE user_profile SET owner_id = $1 WHERE owner_id IS NULL`,
            [adminId]
          );
          if (prof.rowCount) console.log('-> Stamped seed user profile to admin');
        }
      } catch (cvErr) {
        console.warn('-> CV seed ownership warning:', cvErr.message);
      }

      // ── MinIO bucket ──────────────────────────────────────────────────────
      try {
        const bucketExists = await minioClient.bucketExists(BUCKET);
        if (!bucketExists) await minioClient.makeBucket(BUCKET);
        console.log('-> MinIO bucket ready:', BUCKET);
      } catch (minioErr) {
        console.warn('-> MinIO bucket warning:', minioErr.message);
      }
      break;
    } catch (e) {
      if (attempt === MAX) {
        console.error('-> Admin seed failed after all retries:', e.message);
      } else {
        console.log(`-> DB not ready (attempt ${attempt}/${MAX}), retrying in 2s…`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
})();
