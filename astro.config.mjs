import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';

import { loadEnv } from 'vite';
import node from '@astrojs/node';
import alpinejs from '@astrojs/alpinejs';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

const siteUrl = 'https://www.milo-os.com';
const port = parseInt(process.env.PORT || env.PORT || '4321');

export default defineConfig({
  site: siteUrl || `http://localhost:${port}`,
  trailingSlash: 'always',
  output: 'static',
  adapter: node({
    mode: 'middleware',
  }),
  image: {
    layout: 'constrained',
  },
  integrations: [alpinejs(), mdx()],
  vite: {
    plugins: [tailwindcss()],
    css: {
      devSourcemap: true,
    },
  },
  security: {
    allowedDomains: [
      {
        hostname: 'website.staging.env.datum.net',
        protocol: 'https',
      },
    ],
  },
  experimental: {},
  prefetch: true,
});
