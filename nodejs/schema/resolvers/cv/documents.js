// CV domain resolvers — CRUD for the cv_components tree and cvDocument roots,
// cloned from resolvers/framework/components.js and made owner-aware.
// Reads: a node is visible to its owner, to admin, or to everyone when its
// owner_id is NULL (shared/global nodes such as the default template).
// Writes: only the owner (or admin) may mutate a node; global NULL-owned nodes
// are admin-only. Compile / save-pdf / artifact delete are REST (routes/cv/compile.js).
const {
  GraphQLList, GraphQLString, GraphQLID, GraphQLBoolean, GraphQLNonNull,
} = require('graphql');
const { pool } = require('../../../db');
const { CvComponentType, CvComponentInputType, CvArtifactType, CvProfileType, GraphQLJSON } = require('../../types');
const {
  postCvComponent, updateCvComponent, deleteCvComponent,
  deleteCvRelation, relateCvComponents,
} = require('../../helpers/cv');

const isAdmin = (ctx) => ctx?.user?.role === 'admin';
const userId  = (ctx) => ctx?.user?.id ?? null;

// Fetch a node and assert the caller may write to it (owner or admin).
const assertWritable = async (id, ctx) => {
  const res = await pool.query('SELECT owner_id FROM cv_components WHERE id = $1::uuid', [id]);
  const row = res.rows[0];
  if (!row) throw new Error('CV node not found');
  if (isAdmin(ctx)) return true;
  if (row.owner_id && row.owner_id === userId(ctx)) return true;
  throw new Error('Not authorised for this CV node');
};

// Read scope clause: owner OR shared (NULL). Admin gets no clause (sees all).
const readScope = (ctx, params) => {
  if (isAdmin(ctx)) return '';
  params.push(userId(ctx));
  return ` AND (owner_id = $${params.length}::uuid OR owner_id IS NULL)`;
};

const queries = {
  cvComponent: {
    type: new GraphQLList(CvComponentType),
    args: { id: { type: GraphQLString } },
    async resolve(_, { id }, ctx) {
      const params = [id];
      const scope = readScope(ctx, params);
      const res = await pool.query(`SELECT * FROM cv_components WHERE id = $1::uuid${scope}`, params);
      return res.rows;
    },
  },
  cvComponentByName: {
    type: CvComponentType,
    args: { name: { type: GraphQLString } },
    async resolve(_, { name }, ctx) {
      const params = [name];
      const scope = readScope(ctx, params);
      const res = await pool.query(`SELECT * FROM cv_components WHERE name = $1${scope}`, params);
      return res.rows[0] || null;
    },
  },
  cvComponentList: {
    type: new GraphQLList(CvComponentType),
    args: { type: { type: GraphQLString } },
    async resolve(_, { type }, ctx) {
      const params = [type];
      const scope = readScope(ctx, params);
      const res = await pool.query(`SELECT * FROM cv_components WHERE type = $1::text${scope} ORDER BY name`, params);
      return res.rows;
    },
  },
  cvComponentParents: {
    type: new GraphQLList(CvComponentType),
    args: { child_id: { type: GraphQLID } },
    async resolve(_, { child_id }, ctx) {
      const params = [child_id];
      const scope = isAdmin(ctx) ? '' : ` AND (c.owner_id = $2::uuid OR c.owner_id IS NULL)`;
      if (!isAdmin(ctx)) params.push(userId(ctx));
      const res = await pool.query(
        `SELECT c.* FROM cv_components_relationships cr
         JOIN cv_components c ON cr.parent_id = c.id
         WHERE cr.child_id = $1::uuid${scope}`,
        params
      );
      return res.rows;
    },
  },
  cvDocumentList: {
    type: new GraphQLList(CvComponentType),
    async resolve(_, __, ctx) {
      // A user's own CV roots; admin sees every document.
      const params = [];
      let where = `type = 'cvDocument'`;
      if (!isAdmin(ctx)) { params.push(userId(ctx)); where += ` AND owner_id = $1::uuid`; }
      const res = await pool.query(`SELECT * FROM cv_components WHERE ${where} ORDER BY name`, params);
      return res.rows;
    },
  },
  cvDocument: {
    type: CvComponentType,
    args: { id: { type: new GraphQLNonNull(GraphQLID) } },
    async resolve(_, { id }, ctx) {
      const params = [id];
      const scope = readScope(ctx, params);
      const res = await pool.query(`SELECT * FROM cv_components WHERE id = $1::uuid${scope}`, params);
      return res.rows[0] || null;
    },
  },
  cvProfile: {
    type: CvProfileType,
    async resolve(_, __, ctx) {
      const uid = userId(ctx);
      if (!uid) return null;
      const res = await pool.query('SELECT owner_id, data FROM cv_profile WHERE owner_id = $1::uuid', [uid]);
      return res.rows[0] || { owner_id: uid, data: {} };
    },
  },
  cvArtifactList: {
    type: new GraphQLList(CvArtifactType),
    async resolve(_, __, ctx) {
      const params = [];
      let where = '';
      if (!isAdmin(ctx)) { params.push(userId(ctx)); where = `WHERE a.owner_id = $1::uuid`; }
      const res = await pool.query(
        `SELECT a.id, a.cv_component_id, a.file_id, a.owner_id, a.label,
                to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
                f.filename, f.mime_type, f.size
         FROM cv_artifacts a JOIN files f ON a.file_id = f.id
         ${where} ORDER BY a.created_at DESC`,
        params
      );
      return res.rows;
    },
  },
};

const mutations = {
  createCvComponent: {
    type: CvComponentType,
    args: {
      name:     { type: GraphQLString },
      type:     { type: GraphQLString },
      data:     { type: GraphQLJSON },
      options:  { type: GraphQLJSON },
      children: { type: new GraphQLList(CvComponentInputType) },
    },
    resolve(_, args, ctx) {
      return postCvComponent(args.name, args.type, args.data, args.options, userId(ctx), args.children);
    },
  },
  updateCvComponent: {
    type: CvComponentType,
    args: {
      id:      { type: GraphQLID },
      name:    { type: GraphQLString },
      type:    { type: GraphQLString },
      data:    { type: GraphQLJSON },
      options: { type: GraphQLJSON },
    },
    async resolve(_, args, ctx) {
      await assertWritable(args.id, ctx);
      return updateCvComponent(args.id, args.name, args.type, args.data, args.options);
    },
  },
  deleteCvComponent: {
    type: GraphQLBoolean,
    args: { id: { type: GraphQLID } },
    async resolve(_, { id }, ctx) {
      await assertWritable(id, ctx);
      return deleteCvComponent(id);
    },
  },
  createCvRelation: {
    type: GraphQLBoolean,
    args: { parent_id: { type: GraphQLID }, child_id: { type: GraphQLID } },
    async resolve(_, { parent_id, child_id }, ctx) {
      await assertWritable(parent_id, ctx);
      return relateCvComponents(parent_id, child_id);
    },
  },
  deleteCvRelation: {
    type: GraphQLBoolean,
    args: { parent_id: { type: GraphQLID }, child_id: { type: GraphQLID } },
    async resolve(_, { parent_id, child_id }, ctx) {
      await assertWritable(parent_id, ctx);
      return deleteCvRelation(parent_id, child_id);
    },
  },
  swapCvPositions: {
    type: GraphQLBoolean,
    args: {
      parent_id:  { type: GraphQLID },
      child_id_a: { type: GraphQLID },
      child_id_b: { type: GraphQLID },
    },
    async resolve(_, { parent_id, child_id_a, child_id_b }, ctx) {
      await assertWritable(parent_id, ctx);
      const res = await pool.query(
        'SELECT child_id, position FROM cv_components_relationships WHERE parent_id=$1::uuid AND child_id IN ($2::uuid, $3::uuid)',
        [parent_id, child_id_a, child_id_b]
      );
      if (res.rows.length !== 2) return false;
      const byId = Object.fromEntries(res.rows.map(r => [r.child_id, r.position]));
      await pool.query('UPDATE cv_components_relationships SET position=$1 WHERE parent_id=$2::uuid AND child_id=$3::uuid', [byId[child_id_b], parent_id, child_id_a]);
      await pool.query('UPDATE cv_components_relationships SET position=$1 WHERE parent_id=$2::uuid AND child_id=$3::uuid', [byId[child_id_a], parent_id, child_id_b]);
      return true;
    },
  },
  createCvDocument: {
    type: CvComponentType,
    args: {
      name: { type: GraphQLString },
      data: { type: GraphQLJSON },
    },
    resolve(_, args, ctx) {
      const name = args.name || `cv_document_${Date.now()}`;
      return postCvComponent(name, 'cvDocument', args.data ?? {}, {}, userId(ctx), null);
    },
  },
  updateCvDocument: {
    type: CvComponentType,
    args: {
      id:   { type: new GraphQLNonNull(GraphQLID) },
      name: { type: GraphQLString },
      data: { type: GraphQLJSON },
    },
    async resolve(_, { id, name, data }, ctx) {
      await assertWritable(id, ctx);
      const res = await pool.query('SELECT * FROM cv_components WHERE id = $1::uuid', [id]);
      const cur = res.rows[0];
      return updateCvComponent(id, name ?? cur.name, 'cvDocument', data ?? cur.data, cur.options);
    },
  },
  deleteCvDocument: {
    type: GraphQLBoolean,
    args: { id: { type: new GraphQLNonNull(GraphQLID) } },
    async resolve(_, { id }, ctx) {
      await assertWritable(id, ctx);
      return deleteCvComponent(id);
    },
  },
  // The caller's own identity block; upserted by owner_id (one row per user).
  upsertCvProfile: {
    type: CvProfileType,
    args: { data: { type: GraphQLJSON } },
    async resolve(_, { data }, ctx) {
      const uid = userId(ctx);
      if (!uid) throw new Error('Authentication required');
      const res = await pool.query(
        `INSERT INTO cv_profile (owner_id, data) VALUES ($1::uuid, $2::jsonb)
         ON CONFLICT (owner_id) DO UPDATE SET data = EXCLUDED.data
         RETURNING owner_id, data`,
        [uid, data ?? {}]
      );
      return res.rows[0];
    },
  },
};

module.exports = { queries, mutations };
