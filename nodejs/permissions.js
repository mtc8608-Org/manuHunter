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
    'cvComponentList',
    'cvComponentParents',
    'cvDocumentList',
    'cvArtifactList',
    'createCvComponent',
    'updateCvComponent',
    'deleteCvComponent',
    'createCvRelation',
    'deleteCvRelation',
    'swapCvPositions',
    'createCvDocument',
    'updateCvDocument',
    // surveys — DEVIATION from upstream, which places these on the 'user' rung
    // as its worked example of the middle tier. Here every signed-in account may
    // view and answer, so they stay in `registered`; answer reads/edits are
    // owner-scoped in the resolver (admin sees all). The nav area (NAV_AREAS)
    // and the route guard must mirror THIS file, not upstream's — so SURVEYS is
    // a 'registered' area on PrivateRoute here, not TierRoute minTier="user".
    'surveyList',
    'surveyComponent',
    'surveyComponentList',
    'surveyComponentParents',
    'surveyAnswers',
    'submitAnswer',
    'updateAnswer',
  ],

  // GraphQL query/mutation field names requiring tier 'user' (or 'admin').
  // Empty in this fork by design: the jobs/CV/survey domain ops all live in
  // `registered` (every account manages its own rows, owner-scoped in the
  // resolvers), so nothing needs the middle rung. Upstream keeps its surveys
  // here; that placement is app-tuned and does not come down on merge.
  user: [],

  // Everything else requires role === 'admin'.
  // (Informational — enforcement uses the fallback rule above. List admin ops,
  // mutations and queries alike, whose admin-only status is a deliberate
  // decision worth documenting.)
  admin: [
    'roleList', 'createRole', 'updateRole', 'deleteRole',
    'component', 'componentList', 'componentParents', 'componentRelationList',
    'createComponent', 'updateComponent', 'deleteComponent',
    'createComponentRelation', 'deleteComponentRelation', 'swapComponentPositions',
    'createSurveyComponent', 'updateSurveyComponent', 'deleteSurveyComponent',
    'createSurveyComponentRelation', 'deleteSurveyComponentRelation', 'swapSurveyComponentPositions',
    'createSurvey', 'deleteAnswer',
  ],
};
