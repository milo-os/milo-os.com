# milo-os.com

Marketing site for [Milo](https://github.com/datum-cloud/milo) — an open source business operating system for product-led B2B companies, built by [Datum](https://www.datum.net).

Live site: [https://www.milo-os.com](https://www.milo-os.com)

## Overview

This repository contains the public marketing website for Milo. It is built as a static-first Astro site with MDX content, reusable UI components, and a lightweight server layer for runtime features such as health checks and dynamic data endpoints.

## Tech stack

- [Astro](https://astro.build/) 6 with MDX content
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Alpine.js](https://alpinejs.dev/) for client-side interactivity
- [Node.js](https://nodejs.org/) 26 and npm for development and production runtime

The site is pre-rendered to static HTML and served by a custom Node server in [server.mjs](server.mjs), which handles static assets, compressed responses, and middleware for dynamic routes.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 26 (see [.nvmrc](.nvmrc)) with npm
- A local environment file copied from [.env.example](.env.example)

### Install and run locally

```sh
npm ci
cp .env.example .env
npm run dev
```

The development server will be available at [http://localhost:4321](http://localhost:4321).

### Docker

```sh
# Development environment with hot reload
docker compose up dev

# Production build
docker compose up prod
```

## Available scripts

| Command | Purpose |
| :------ | :----- |
| `npm run dev` | Start the Astro dev server with type checking |
| `npm run build` | Type-check and build the site to `./dist/` |
| `npm run start` | Start the production server from [server.mjs](server.mjs) |
| `npm run preview` | Preview the built site locally |
| `npm run typecheck` | Run Astro type checks |
| `npm run lint` | Lint JavaScript, TypeScript, Astro, and MD/MDX files |
| `npm run lint:md` | Lint MDX content |
| `npm run format` | Format supported source files |

## Environment variables

The app reads configuration from [.env.example](.env.example). The most important values are:

| Variable | Required | Description |
| :------- | :------- | :---------- |
| `SITE_URL` | No | Public site URL (default: `http://www.milo-os.com`) |
| `PORT` | No | Server port (default: `4321`) |
| `APP_ID` | Yes* | GitHub App ID for roadmap and changelog data |
| `APP_INSTALLATION_ID` | Yes* | GitHub App installation ID |
| `APP_PRIVATE_KEY` | Yes* | GitHub App private key (PEM) |
| `CACHE_CLEAR_SECRET` | Yes* | Secret for authenticating the cache-clear endpoint |

* Required for full functionality. The site can still render without these values, but dynamic features such as roadmap data and changelog data will not work.

## Project structure

```text
/
├── config/              # Kubernetes and Gateway API deployment manifests
├── docs/                # Internal documentation, including release notes
├── public/              # Static assets such as fonts and images
├── src/
│   ├── components/      # Astro components
│   ├── content/         # MDX pages and legal content
│   ├── data/            # Shared site config and navigation data
│   ├── layouts/         # Shared page layouts
│   ├── libs/            # GitHub, cache, and utility modules
│   ├── pages/           # Routes for the site
│   ├── types/           # TypeScript types
│   ├── utils/           # Shared helpers
│   └── v1/              # Legacy styles, scripts, and assets
├── astro.config.mjs
├── docker-compose.yml
├── Dockerfile
└── server.mjs           # Production HTTP server
```

## Contributing

Before opening a pull request, run the relevant checks locally:

```sh
npm run typecheck
npm run lint
npm run format
```

## Deployment

The site runs on Kubernetes behind the Gateway API, with Datum Cloud edge proxying public traffic. See [docs/release.md](docs/release.md) for deployment details.

```sh
# Deploy to cluster
kubectl apply -k config/base

# Update Datum Cloud gateway config
kubectl apply -k config/gateway --kubeconfig datumcfg -n milo-os-com
```

Health check endpoints are available at `/healthz`, `/livez`, and `/readyz`.
