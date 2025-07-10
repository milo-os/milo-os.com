// @ts-check

import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import AstroPureIntegration from 'astro-pure';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import node from '@astrojs/node';

import rehypeAutolinkHeadings from './src/plugins/rehype-auto-link-headings.js';
import {
  addCopyButton,
  addLanguage,
  addTitle,
  transformerNotationDiff,
  transformerNotationHighlight,
  updateStyle,
} from './src/plugins/shiki-transformers.js';
import config from './src/site.config.js';
import { remarkRemoveFirstH1 } from './src/plugins/remark-remove-first-h1.ts';

export default defineConfig({
  site: 'https://www.milo-os.com',
  trailingSlash: 'ignore',

  adapter: node({
    mode: 'standalone',
  }),
  output: 'server',

  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },

  integrations: [
    // astro-pure will automatically add sitemap, mdx & unocss
    // sitemap(),
    // mdx(),
    AstroPureIntegration(config),
    // (await import('@playform/compress')).default({
    //   SVG: false,
    //   Exclude: ['index.*.js']
    // }),

    // Temporary fix vercel adapter
    // static build method is not needed
  ],
  // root: './my-project-directory',

  // Prefetch Options
  prefetch: true,
  // Server Options
  server: {
    host: true,
  },
  // Markdown Options
  markdown: {
    remarkPlugins: [remarkMath, remarkRemoveFirstH1],
    rehypePlugins: [
      [rehypeKatex, {}],
      rehypeHeadingIds,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { className: ['anchor'] },
          content: { type: 'text', value: '#' },
        },
      ],
    ],
    // https://docs.astro.build/en/guides/syntax-highlighting/
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        updateStyle(),
        addTitle(),
        addLanguage(),
        addCopyButton(2000),
      ],
    },
  },
  experimental: {
    contentIntellisense: true,
  },
  vite: {
    plugins: [],
    server: {
      watch: {
        usePolling: true,
        ignored: ['!**/packages/pure/**'],
      },
    },
  },
});
