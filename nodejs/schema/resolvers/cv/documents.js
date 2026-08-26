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
const { CvComponentType, CvComponentInputType, CvArtifactType, GraphQLJSON } = require('../../types');
const {
  postCvComponent, updateCvComponent, deleteCvComponent,
  deleteCvRelation, relateCvComponents,
} = require('../../helpers/cv');
const {
  userId, isAdmin, assertOwner, assertReadable, ownerScope,
} = require('../../helpers/ownership');

// Every assert in this module targets the same table with the same label.
const CV = { label: 'CV node' };

// Read scope clause: owner OR shared (NULL). Admin gets no clause (sees all).
//
// NOT `ownerScope` from the shared helpers, and not a candidate for it: that one
// is a strict `owner_id = me`, which is right for rows that always have an owner
// (survey answers, artifacts). CV nodes deliberately include NULL-owned rows —
// the shared default template and the sample CVs — which every user must be able
// to READ (writes on them stay admin-only via assertOwner). Collapsing this onto
// ownerScope would hide the shared template from every non-admin.
const readScope = (ctx, params) => {
  if (isAdmin(ctx)) return '';
  params.push(userId(ctx));
  return ` AND (owner_id = $${params.length}::uuid OR owner_id IS NULL)`;
};

// A cvDocument's `data.template_id` is a client-supplied UUID that cvAssemble
// later dereferences with NO owner filter, rendering the target's preamble and
// header into the PDF. That makes it a link mutation in disguise: writing the id
// is what grants the read. Authorise the far end here, exactly as
// createCvRelation does for its child — otherwise pointing a CV at someone
// else's template exfiltrates it through your own compile.
const assertTemplateReadable = async (data, ctx) => {
  const id = data?.template_id;
  if (id) await assertReadable('cv_components', id, ctx, CV);
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
      // A user's own CV roots plus shared NULL-owned samples (read-only for
      // non-admins — writes on NULL nodes are admin-only); admin sees every document.
      const params = [];
      const where = `type = 'cvDocument'${readScope(ctx, params)}`;
      const res = await pool.query(`SELECT * FROM cv_components WHERE ${where} ORDER BY name`, params);
      return res.rows;
    },
  },
  cvArtifactList: {
    type: new GraphQLList(CvArtifactType),
    async resolve(_, __, ctx) {
      const params = [];
      const where = `WHERE 1=1${ownerScope(ctx, params, 'a.owner_id')}`;
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
      await assertOwner('cv_components', args.id, ctx, CV);
      return updateCvComponent(args.id, args.name, args.type, args.data, args.options);
    },
  },
  deleteCvComponent: {
    type: GraphQLBoolean,
    args: { id: { type: GraphQLID } },
    async resolve(_, { id }, ctx) {
      await assertOwner('cv_components', id, ctx, CV);
      return deleteCvComponent(id);
    },
  },
  createCvRelation: {
    type: GraphQLBoolean,
    args: { parent_id: { type: GraphQLID }, child_id: { type: GraphQLID } },
    async resolve(_, { parent_id, child_id }, ctx) {
      await assertOwner('cv_components', parent_id, ctx, CV);
      // The child must be readable too — compile walks relationships without an
      // owner filter, so linking a foreign node would exfiltrate its content.
      await assertReadable('cv_components', child_id, ctx, CV);
      return relateCvComponents(parent_id, child_id);
    },
  },
  deleteCvRelation: {
    type: GraphQLBoolean,
    args: { parent_id: { type: GraphQLID }, child_id: { type: GraphQLID } },
    async resolve(_, { parent_id, child_id }, ctx) {
      await assertOwner('cv_components', parent_id, ctx, CV);
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
      await assertOwner('cv_components', parent_id, ctx, CV);
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
    async resolve(_, args, ctx) {
      const name = args.name || `cv_document_${Date.now()}`;
      await assertTemplateReadable(args.data, ctx);
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
      await assertOwner('cv_components', id, ctx, CV);
      await assertTemplateReadable(data, ctx);
      const res = await pool.query('SELECT * FROM cv_components WHERE id = $1::uuid', [id]);
      const cur = res.rows[0];
      return updateCvComponent(id, name ?? cur.name, 'cvDocument', data ?? cur.data, cur.options);
    },
  },
};

module.exports = { queries, mutations };
