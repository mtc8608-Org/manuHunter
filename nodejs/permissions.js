// ── Role-based access configuration ──────────────────────────────────────────
// Controls which GraphQL operations are accessible without admin privileges.
// Applied identically to queries AND mutations (schema/index.js):
//   public — no token required
//   user   — any valid JWT required (any role)
//   admin  — role must be 'admin'; EVERYTHING not listed above defaults here
//
// A query left out of both lists is admin-only, same as a mutation — so a new
// operation is locked down by default. Opening one to users/public is a
// deliberate act of adding its name here. In-resolver owner-scoping is still
// required for anything in the `user` tier (a user must not see others' rows).
//
// The `admin` list below is informational only (the fallback enforces it);
// keep query names that are conceptually admin here so intent is documented.

module.exports = {
  // GraphQL query field names accessible without any token
  public: [
    'componentByName',
    'surveyList',
    'surveyComponent',
    'surveyComponentList',
    'surveyComponentParents',
    'surveyAnswers',
  ],

  // GraphQL query/mutation field names accessible with any valid token
  user: [
    'me',
    // account self-service — resolvers scope by the caller's JWT, no owner argument
    'userProfile',
    'upsertUserProfile',
    'userSecrets',
    'setUserSecret',
    'clearUserSecret',
    'submitAnswer',
    'updateAnswer',
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
  ],

  // Everything else requires role === 'admin'.
  // (Informational — enforcement uses the fallback rule above. Only list real mutations.)
  admin: [
    'surveyStats',
    'createComponent', 'updateComponent', 'deleteComponent',
    'createComponentRelation', 'deleteComponentRelation',
    'createSurveyComponent', 'updateSurveyComponent', 'deleteSurveyComponent',
    'createSurveyComponentRelation', 'deleteSurveyComponentRelation',
    'createSurvey', 'updateSurvey', 'deleteSurvey', 'deleteAnswer',
  ],
};
