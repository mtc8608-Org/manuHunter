const { GraphQLSchema, GraphQLObjectType, execute: graphqlExecute } = require('graphql');
const { createHandler } = require('graphql-http/lib/use/express');
const permissions = require('../permissions');

// [FRAMEWORK]
const componentResolvers = require('./resolvers/framework/components');
const surveyResolvers    = require('./resolvers/framework/survey');
const userResolvers      = require('./resolvers/framework/users');

// [JOBS]
const applicationResolvers = require('./resolvers/jobs/applications');

// [CV]
const cvResolvers = require('./resolvers/cv/documents');

const Query = new GraphQLObjectType({
  name: 'Query',
  fields: {
    ...componentResolvers.queries,
    ...surveyResolvers.queries,
    ...userResolvers.queries,
    ...applicationResolvers.queries,
    ...cvResolvers.queries,
  },
});

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    ...componentResolvers.mutations,
    ...surveyResolvers.mutations,
    ...userResolvers.mutations,
    ...applicationResolvers.mutations,
    ...cvResolvers.mutations,
  },
});

const schema = new GraphQLSchema({ query: Query, mutation: Mutation });

const handler = createHandler({
  schema,
  context: (req) => ({ user: req.raw?.user ?? null }),
  execute: async (args) => {
    const { document, contextValue } = args;
    const name = document.definitions[0]?.selectionSet?.selections[0]?.name?.value ?? '';
    const user = contextValue?.user;

    // Same rule for queries and mutations: registered list → any JWT, user
    // list → role user/admin, public list → open, everything else → admin.
    // No query/mutation asymmetry.
    if (permissions.registered.includes(name)) {
      if (!user) return { errors: [{ message: 'Authentication required' }] };
    } else if (permissions.user.includes(name)) {
      if (!user) return { errors: [{ message: 'Authentication required' }] };
      if (user.role !== 'user' && user.role !== 'admin') {
        return { errors: [{ message: 'User access required' }] };
      }
    } else if (!permissions.public.includes(name)) {
      if (user?.role !== 'admin') return { errors: [{ message: 'Admin access required' }] };
    }
    return graphqlExecute(args);
  },
});

module.exports = { schema, handler };
