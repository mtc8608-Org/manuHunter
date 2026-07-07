// ── Role-based access configuration ──────────────────────────────────────────
// Controls which GraphQL operations are accessible without admin privileges.
// Applied identically to queries AND mutations (schema/index.js):
//   registered — any valid JWT required (any role)
//   user       — tier must be 'user' or 'admin'
//   admin      — tier must be 'admin'; EVERYTHING not listed above defaults here
//
// There is NO public tier (deliberate deviation from upstream, which keeps a
// componentByName-only public list): every GraphQL operation requires a valid
// JWT — anonymous requests always fail. Anonymous visitors get only the REST
// /login and /register endpoints (and the tokenless file-download streams,
// which exist because <img> tags cannot carry the auth header).
//
// Checks compare the caller's *tier*, not the role name: roles live in the
// `roles` table and each aliases onto one of these three tiers (backoffice
// Roles page). The tier is resolved at login and carried in the JWT.
//
// A query left out of all lists is admin-only, same as a mutation — so a new
// operation is locked down by default. Opening one to lower tiers is a
// deliberate act of adding its name here. In-resolver owner-scoping is still
// required for anything in the `registered`/`user` tiers (a user must not see
// others' rows).
//
// The `admin` list below is informational only (the fallback enforces it);
// keep query names that are conceptually admin here so intent is documented.

module.exports = {
  // GraphQL query/mutation field names accessible with any valid token
  registered: [
    'me',
    // seeded form/content trees fetched by name (FormRenderer on every page,
    // Landing content for signed-in users)
    'componentByName',
    // account self-service — resolvers scope by the caller's JWT, no owner argument
    'userProfile',
    'upsertUserProfile',
    'userSecrets',
    'setUserSecret',
    'clearUserSecret',
    // [JOBS] — every user manages their own applications; resolvers scope by user_id
    'applications',
    'application',
    'createApplication',
    'updateApplication',
    'deleteApplication',
    'addApplicationEvent',
    'linkApplicationFile',
    'unlinkApplicationFile',
    // [CV] — every user builds their own CVs; resolvers scope by cv_components.owner_id
    'cvComponent',
    'cvComponentByName',
    'cvComponentList',
    'cvComponentParents',
    'cvDocumentList',
    'cvDocument',
    'cvArtifactList',
    'createCvComponent',
    'updateCvComponent',
    'deleteCvComponent',
    'createCvRelation',
    'deleteCvRelation',
    'swapCvPositions',
    'createCvDocument',
    'updateCvDocument',
    'deleteCvDocument',
    // surveys — viewing and answering is open to every signed-in account;
    // answer reads/edits are owner-scoped in the resolver (admin sees all)
    'surveyList',
    'surveyComponent',
    'surveyComponentList',
    'surveyComponentParents',
    'surveyAnswers',
    'submitAnswer',
    'updateAnswer',
  ],

  // GraphQL query/mutation field names requiring role 'user' (or 'admin').
  // Empty in the framework — forks add their owner-scoped domain ops here.
  user: [],

  // Everything else requires role === 'admin'.
  // (Informational — enforcement uses the fallback rule above. List admin ops,
  // mutations and queries alike, whose admin-only status is a deliberate
  // decision worth documenting.)
  admin: [
    'roleList', 'createRole', 'updateRole', 'deleteRole',
    'createComponent', 'updateComponent', 'deleteComponent',
    'createComponentRelation', 'deleteComponentRelation', 'swapComponentPositions',
    'createSurveyComponent', 'updateSurveyComponent', 'deleteSurveyComponent',
    'createSurveyComponentRelation', 'deleteSurveyComponentRelation', 'swapSurveyComponentPositions',
    'createSurvey', 'deleteAnswer',
  ],
};
