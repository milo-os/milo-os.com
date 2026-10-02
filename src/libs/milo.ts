import { graph } from '@/src/libs/github';
import { Cache } from '@libs/cache';

import changelogsFallbackData from '@content/changelog.json';

const cache = new Cache('.cache');
const owner = 'datum-cloud';

type RoadmapProps = {
  number: number;
  id: string;
  title: string;
  body: string;
  url: string;
  labels?: { nodes: Array<{ name: string }> };
  createdAt: string;
};

type ChangelogProps = {
  id: string;
  title: string;
  body: string;
  url: string;
  labels?: { nodes: Array<{ name: string }> };
  createdAt: string;
};

async function stargazerCount(isClientSide: boolean = false): Promise<number> {
  type ResponseProps = {
    repository: {
      stargazerCount: number;
    };
  };

  let stargazers = 0;
  const name = 'milo';

  if (cache.has('stargazerCount')) {
    return cache.get<number>('stargazerCount') as number;
  } else {
    if (isClientSide) {
      try {
        const API_URL = `https://api.github.com/repos/${owner}/${name}`;
        const response = await fetch(API_URL);
        const data = await response.json();

        if (response.ok) {
          stargazers = data.stargazers_count || 0;
          cache.set('stargazerCount', stargazers, 1000 * 60 * 10); // cache for 10 minutes
        }
      } catch {
        stargazers = 0;
      }
    } else {
      try {
        const query = `
          query ($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
              stargazerCount
            }
          }
        `;

        const variables = {
          owner,
          name,
        };

        const response = (await graph(query, variables)) as ResponseProps;
        stargazers = response.repository.stargazerCount || 0;
        cache.set('stargazerCount', stargazers, 1000 * 60 * 10); // cache for 10 minutes
      } catch {
        stargazers = 0;
      }
    }

    return stargazers;
  }
}

async function roadmaps(): Promise<RoadmapProps[]> {
  type ResponseProps = {
    search: {
      issueCount: number;
      nodes: [
        {
          number: number;
          id: string;
          title: string;
          body: string;
          url: string;
          labels: {
            nodes: Array<{
              name: string;
            }>;
          };
          createdAt: string;
        },
      ];
    };
  };

  let roadmaps: RoadmapProps[] = [];

  if (cache.has('roadmaps')) {
    return cache.get<RoadmapProps[]>('roadmaps') as RoadmapProps[];
  } else {
    try {
      const query = `
          query {
            search(query: "repo:datum-cloud/enhancements is:issue label:\\"Roadmap Vote\\" label:Milo", type: ISSUE, first: 30) {
              issueCount
              nodes {
                ... on Issue {
                  number
                  id
                  title
                  body
                  url
                  labels(first: 5) {
                    nodes {
                      name
                    }
                  }
                  createdAt
                }
              }
            }
          }`;

      const response = (await graph(query)) as ResponseProps;
      roadmaps = Object(response.search.nodes).map((issue: RoadmapProps) => ({
        ...issue,
      }));

      cache.set('roadmaps', roadmaps, 1000 * 60 * 10); // cache for 30 minutes
      return roadmaps;
    } catch {
      console.log('Roadmap: Failed to fetch roadmap data, showing empty list.');
      return [];
    }
  }
}

async function changelogs(): Promise<ChangelogProps[]> {
  let changelogs: ChangelogProps[] = [];

  type ResponseProps = {
    repository: {
      discussions: {
        nodes: [
          {
            id: string;
            title: string;
            body: string;
            url: string;
            createdAt: string;
            labels: {
              nodes: Array<{
                name: string;
              }>;
            };
          },
        ];
      };
    };
  };

  const name = 'datum';
  const categoryVariables = {
    owner,
    name,
    slug: 'product-updates-and-releases',
  };

  if (cache.has('changelogs')) {
    return cache.get<ChangelogProps[]>('changelogs') as ChangelogProps[];
  } else {
    try {
      const categoryQuery = `
      query ($owner:String!, $name:String!, $slug:String!) {
        repository(owner: $owner, name: $name) {
          discussionCategory(slug: $slug){
            id,
          }
        }
      }`;

      const categoryResponse = (await graph(categoryQuery, categoryVariables)) as {
        repository: { discussionCategory: { id: string } };
      };

      const categoryId = categoryResponse.repository.discussionCategory.id as string;

      const query = `
      query ($owner:String!, $name:String!, $categoryId:ID!) {
        repository(owner: $owner, name: $name) {
          discussions(first: 30, after: null, categoryId: $categoryId) {
            nodes {
              id,
              title,
              body,
              url,
              createdAt,
              labels (first: 5, last: null) {
                nodes {
                  name,
                  color,
                }
              },
            }
          }
        }
      }
    `;

      const variables = {
        owner,
        name,
        categoryId,
      };
      const response = (await graph(query, variables)) as ResponseProps;
      changelogs = Object(response.repository.discussions.nodes).map((log: ChangelogProps) => ({
        ...log,
      }));
      cache.set('changelogs', changelogs, 1000 * 60 * 10); // cache for 10 minutes
      return changelogs;
    } catch {
      if (changelogs.length < 1) {
        console.log('Changelogs: Using static roadmap data as fallback.');
        changelogs = changelogsFallbackData as ChangelogProps[];
      }

      return changelogs;
    }
  }
}

export { stargazerCount, roadmaps, changelogs, type RoadmapProps, type ChangelogProps };
