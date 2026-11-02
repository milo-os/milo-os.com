import { createServer } from 'http';
import { handler } from './dist/server/entry.mjs';
import sirv from 'sirv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createReadStream, existsSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || '0.0.0.0';

// Client dir: ./dist/client in dev; ../client in the bundled unikernel layout
// (esbuild bundle lives in dist/server/). CLIENT_DIR env overrides.
const CLIENT_DIR =
  process.env.CLIENT_DIR ||
  (existsSync(join(__dirname, 'dist', 'client'))
    ? join(__dirname, 'dist', 'client')
    : join(__dirname, '..', 'client'));

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
  '.pf_fragment': 'application/octet-stream',
  '.pf_index': 'application/octet-stream',
  '.pf_meta': 'application/octet-stream',
  '.pagefind': 'application/octet-stream',
};

const COMPRESSIBLE_EXTENSIONS = /\.(html|css|js|mjs|json|xml|svg|txt|map)$/;

// File extensions that should trigger download instead of display
const DOWNLOAD_EXTENSIONS = /\.(docx?|xlsx?|pptx?|zip)$/i;

// Static file server for pre-rendered pages and assets
const staticServer = sirv(CLIENT_DIR, {
  maxAge: 31536000,
  immutable: true,
  gzip: true,
  brotli: true,
  etag: true,
  dotfiles: false,
  extensions: ['html'], // Auto-append .html for clean URLs
  single: false, // Don't serve index.html for all routes (SPA mode)
  setHeaders: (res, pathname) => {
    if (pathname.includes('/_astro/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (pathname.match(/\.(html)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
    // Force download for Office documents and archives
    if (DOWNLOAD_EXTENSIONS.test(pathname)) {
      const filename = pathname.split('/').pop();
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
  },
});

function getContentType(url) {
  const ext = url.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function isCompressible(url) {
  return COMPRESSIBLE_EXTENSIONS.test(url);
}

// Serve pre-compressed files (.gz, .br) for text-based content
function serveCompressed(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  let url = req.url.split('?')[0];

  if (url.endsWith('/')) {
    url += 'index.html';
  }

  if (!isCompressible(url)) {
    return next();
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const filePath = join(CLIENT_DIR, url);

  // Try brotli first (better compression ratio)
  if (acceptEncoding.includes('br')) {
    const brPath = filePath + '.br';
    if (existsSync(brPath)) {
      const stat = statSync(brPath);
      res.writeHead(200, {
        'Content-Type': getContentType(url),
        'Content-Encoding': 'br',
        'Content-Length': stat.size,
        Vary: 'Accept-Encoding',
        'Cache-Control': url.includes('/_astro/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate',
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        createReadStream(brPath).pipe(res);
      }
      return;
    }
  }

  // Fallback to gzip (widely supported)
  if (acceptEncoding.includes('gzip')) {
    const gzPath = filePath + '.gz';
    if (existsSync(gzPath)) {
      const stat = statSync(gzPath);
      res.writeHead(200, {
        'Content-Type': getContentType(url),
        'Content-Encoding': 'gzip',
        'Content-Length': stat.size,
        Vary: 'Accept-Encoding',
        'Cache-Control': url.includes('/_astro/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate',
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        createReadStream(gzPath).pipe(res);
      }
      return;
    }
  }

  next();
}

const server = createServer((req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }

  const url = req.url.split('?')[0];

  if (/^\/legal(?:\/|$)/.test(url)) {
    res.writeHead(302, { Location: 'https://www.datum.net/legal/terms' });
    res.end();
    return;
  }

  // Health check endpoints for Kubernetes probes
  if (url === '/healthz' || url === '/livez' || url === '/readyz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // Middleware order: compressed files → static files → Astro handler
  serveCompressed(req, res, () => {
    staticServer(req, res, () => {
      handler(req, res);
    });
  });
});

server.keepAliveTimeout = 75_000;
server.headersTimeout = 76_000;

server.on('error', (err) => {
  console.error('Server error:', err);
});

const SHUTDOWN_TIMEOUT_MS = 25_000;
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully...`);

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  server.closeIdleConnections();

  setTimeout(() => {
    console.log('Shutdown timeout reached, closing remaining connections');
    server.closeAllConnections();
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Server running                                            ║
║                                                            ║
║  ✅ Pre-compressed files (.gz, .br) enabled                ║
║  ✅ Static file server (images, fonts, etc.) enabled       ║
║  ✅ Astro SSR handler enabled                              ║
╚════════════════════════════════════════════════════════════╝
  `);
});
