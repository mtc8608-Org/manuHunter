const {
  GraphQLList,
  GraphQLString,
  GraphQLID,
  GraphQLBoolean,
  GraphQLNonNull,
} = require('graphql');
const { pool } = require('../../../db');
const { ApplicationType, ApplicationEventType } = require('../../types');

// Formatted column list — dates/timestamps as strings the frontend can use directly.
const APP_COLS = `id, user_id, company, role, location, source, job_url, job_description,
  status, salary, contact, notes,
  to_char(applied_at, 'YYYY-MM-DD') AS applied_at,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at`;

// Columns a client may set on create/update, in the order they map to the DB.
const WRITABLE = [
  'company', 'role', 'location', 'source', 'job_url', 'job_description',
  'status', 'salary', 'contact', 'notes', 'applied_at',
];

// Assert the caller owns the application (or is admin). Single error for
// missing and foreign rows — no existence oracle.
const assertApplicationOwner = async (application_id, ctx) => {
  const res = await pool.query('SELECT user_id FROM applications WHERE id = $1::uuid', [application_id]);
  const row = res.rows[0];
  if (!row || (ctx?.user?.tier !== 'admin' && row.user_id !== ctx?.user?.id)) {
    throw new Error('Application not found or not authorised');
  }
};

const queries = {
  // Admin sees every application; a regular user sees only their own.
  applications: {
    type: new GraphQLList(ApplicationType),
    args: { status: { type: GraphQLString } },
    async resolve(_, { status }, ctx) {
      console.log('-> List applications (status filter:', status, ')');
      const clauses = [];
      const params  = [];
      if (ctx?.user?.tier !== 'admin') {
        params.push(ctx?.user?.id);
        clauses.push(`user_id = $${params.length}::uuid`);
      }
      if (status) {
        params.push(status);
        clauses.push(`status = $${params.length}`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const res = await pool.query(
        `SELECT ${APP_COLS} FROM applications ${where} ORDER BY COALESCE(applied_at, created_at::date) DESC, created_at DESC`,
        params
      );
      return res.rows;
    },
  },
  application: {
    type: ApplicationType,
    args: { id: { type: new GraphQLNonNull(GraphQLID) } },
    async resolve(_, { id }, ctx) {
      console.log('-> Get application:', id);
      const res = await pool.query(`SELECT ${APP_COLS} FROM applications WHERE id = $1::uuid`, [id]);
      const row = res.rows[0];
      // Single error for missing and foreign rows — no existence oracle.
      if (!row || (ctx?.user?.tier !== 'admin' && row.user_id !== ctx?.user?.id)) {
        throw new Error('Application not found or not authorised');
      }
      return row;
    },
  },
};

const mutations = {
  createApplication: {
    type: ApplicationType,
    args: {
      company:         { type: new GraphQLNonNull(GraphQLString) },
      role:            { type: new GraphQLNonNull(GraphQLString) },
      location:        { type: GraphQLString },
      source:          { type: GraphQLString },
      job_url:         { type: GraphQLString },
      job_description: { type: GraphQLString },
      status:          { type: GraphQLString },
      salary:          { type: GraphQLString },
      contact:         { type: GraphQLString },
      notes:           { type: GraphQLString },
      applied_at:      { type: GraphQLString },
    },
    async resolve(_, args, ctx) {
      console.log('-> Create application:', args.company, '/', args.role);
      const cols = ['user_id', ...WRITABLE.filter(c => args[c] !== undefined)];
      const vals = [ctx?.user?.id ?? null, ...cols.slice(1).map(c => args[c])];
      const placeholders = cols.map((c, i) =>
        c === 'user_id' ? `$${i + 1}::uuid` : c === 'applied_at' ? `$${i + 1}::date` : `$${i + 1}`
      );
      const res = await pool.query(
        `INSERT INTO applications (${cols.join(', ')}) VALUES (${placeholders.join(', ')})
         RETURNING ${APP_COLS}`,
        vals
      );
      return res.rows[0];
    },
  },
  updateApplication: {
    type: ApplicationType,
    args: {
      id:              { type: new GraphQLNonNull(GraphQLID) },
      company:         { type: GraphQLString },
      role:            { type: GraphQLString },
      location:        { type: GraphQLString },
      source:          { type: GraphQLString },
      job_url:         { type: GraphQLString },
      job_description: { type: GraphQLString },
      status:          { type: GraphQLString },
      salary:          { type: GraphQLString },
      contact:         { type: GraphQLString },
      notes:           { type: GraphQLString },
      applied_at:      { type: GraphQLString },
    },
    async resolve(_, { id, ...rest }, ctx) {
      console.log('-> Update application:', id);
      const fields = WRITABLE.filter(c => rest[c] !== undefined);
      if (!fields.length) throw new Error('No fields to update');
      const sets   = fields.map((c, i) => c === 'applied_at' ? `${c} = $${i + 1}::date` : `${c} = $${i + 1}`);
      const params = fields.map(c => rest[c]);
      params.push(id);
      const scope = ctx?.user?.tier === 'admin' ? '' : ` AND user_id = $${params.length + 1}::uuid`;
      if (scope) params.push(ctx?.user?.id);
      const res = await pool.query(
        `UPDATE applications SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${fields.length + 1}::uuid${scope} RETURNING ${APP_COLS}`,
        params
      );
      if (!res.rows[0]) throw new Error('Application not found or not authorised');
      return res.rows[0];
    },
  },
  deleteApplication: {
    type: GraphQLBoolean,
    args: { id: { type: new GraphQLNonNull(GraphQLID) } },
    async resolve(_, { id }, ctx) {
      console.log('-> Delete application:', id);
      const params = [id];
      let scope = '';
      if (ctx?.user?.tier !== 'admin') { params.push(ctx?.user?.id); scope = ' AND user_id = $2::uuid'; }
      await pool.query(`DELETE FROM applications WHERE id = $1::uuid${scope}`, params);
      return true;
    },
  },
  addApplicationEvent: {
    type: ApplicationEventType,
    args: {
      application_id: { type: new GraphQLNonNull(GraphQLID) },
      event_type:     { type: new GraphQLNonNull(GraphQLString) },
      detail:         { type: GraphQLString },
    },
    async resolve(_, { application_id, event_type, detail }, ctx) {
      console.log('-> Add application event:', application_id, event_type);
      await assertApplicationOwner(application_id, ctx);
      const res = await pool.query(
        `INSERT INTO application_events (application_id, event_type, detail)
         VALUES ($1::uuid, $2, $3)
         RETURNING id, application_id, event_type, detail,
           to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS occurred_at`,
        [application_id, event_type, detail ?? null]
      );
      return res.rows[0];
    },
  },
  // Link an already-uploaded file (from POST /api/files/upload) to an application.
  linkApplicationFile: {
    type: GraphQLBoolean,
    args: {
      application_id: { type: new GraphQLNonNull(GraphQLID) },
      file_id:        { type: new GraphQLNonNull(GraphQLID) },
      kind:           { type: GraphQLString },
    },
    async resolve(_, { application_id, file_id, kind }, ctx) {
      console.log('-> Link file', file_id, 'to application', application_id);
      await assertApplicationOwner(application_id, ctx);
      // The file must be the caller's own upload too (admin may link any).
      const file = await pool.query('SELECT uploaded_by FROM files WHERE id = $1::uuid', [file_id]);
      if (!file.rows[0] || (ctx?.user?.tier !== 'admin' && file.rows[0].uploaded_by !== ctx?.user?.id)) {
        throw new Error('File not found or not authorised');
      }
      await pool.query(
        `INSERT INTO application_files (application_id, file_id, kind)
         VALUES ($1::uuid, $2::uuid, $3) ON CONFLICT (application_id, file_id) DO UPDATE SET kind = EXCLUDED.kind`,
        [application_id, file_id, kind ?? 'cv']
      );
      return true;
    },
  },
  unlinkApplicationFile: {
    type: GraphQLBoolean,
    args: {
      application_id: { type: new GraphQLNonNull(GraphQLID) },
      file_id:        { type: new GraphQLNonNull(GraphQLID) },
    },
    async resolve(_, { application_id, file_id }, ctx) {
      console.log('-> Unlink file', file_id, 'from application', application_id);
      await assertApplicationOwner(application_id, ctx);
      await pool.query(
        'DELETE FROM application_files WHERE application_id = $1::uuid AND file_id = $2::uuid',
        [application_id, file_id]
      );
      return true;
    },
  },
};

module.exports = { queries, mutations };
