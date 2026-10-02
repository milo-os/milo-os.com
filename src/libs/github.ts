import { Octokit } from '@octokit/core';
import { createAppAuth } from '@octokit/auth-app';
import { graphql } from '@octokit/graphql';
import type { RequestParameters } from '@octokit/types';

// Read from process.env only: import.meta.env would inline these secrets into the build output.
const appId = process.env.APP_ID;
const privateKey = process.env.APP_PRIVATE_KEY;
const installationId = parseInt(process.env.APP_INSTALLATION_ID || '0', 10);

async function graph(query: string, variables?: RequestParameters) {
  let response = {};

  if (appId && installationId && privateKey) {
    const auth = createAppAuth({
      appId,
      privateKey,
      installationId,
    });

    const octokitWithAuth = graphql.defaults({
      request: {
        hook: auth.hook,
      },
    });

    try {
      response = await octokitWithAuth(query, variables);
    } catch (error) {
      console.error('Error fetching with graphql: ', error);
    }
  } else {
    console.log('GitHub-graphQL: App credentials are not set properly.');
  }

  return response;
}

async function rest(query: string, variables: RequestParameters = {}) {
  let response = {};

  if (appId && installationId && privateKey) {
    const octokitWithAuth = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId,
      },
    });

    try {
      response = await octokitWithAuth.request(query, variables);
    } catch (error) {
      console.error('Error fetching with rest: ', error);
    }
  } else {
    console.log('GitHub-rest: App credentials are not set properly.');
  }

  return response;
}

export { graph, rest };
