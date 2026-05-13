/**
 * Test reverse proxy for webgyb.
 * Starts two listeners:
 *   :8080 — plain pass-through  (simulates subdomain: webgyb.domain.com → app on :3000)
 *   :8081 — prefix-stripping    (simulates subfolder:  domain.com/webgyb → app on :3001)
 *           Strips /webgyb prefix before forwarding, like:
 *           nginx: location /webgyb/ { proxy_pass http://localhost:3001/; }
 *
 * Usage:
 *   node test-proxy.mjs
 *
 * App requirements:
 *   - Port 3000: app WITHOUT BASE_PATH  (subdomain test)
 *   - Port 3001: app WITH BASE_PATH=/webgyb (subfolder test)
 */

import http from 'http';

const STRIP_PREFIX = '/webgyb';

function createProxy(listenPort, targetPort, stripPrefix = '') {
  const server = http.createServer((req, res) => {
    let path = req.url || '/';

    // Strip the prefix if configured (simulates nginx proxy_pass with trailing slash)
    if (stripPrefix && path.startsWith(stripPrefix)) {
      path = path.slice(stripPrefix.length) || '/';
      if (!path.startsWith('/')) path = '/' + path;
    }

    const options = {
      hostname: '127.0.0.1',
      port: targetPort,
      path,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${targetPort}`,
        'x-forwarded-for': req.socket.remoteAddress,
        'x-forwarded-proto': 'http',
        'x-forwarded-host': req.headers.host,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error(`[proxy :${listenPort}] upstream error:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end(`Upstream error: ${err.message}`);
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  server.listen(listenPort, '127.0.0.1', () => {
    const desc = stripPrefix ? `(strips ${stripPrefix})` : '(pass-through)';
    console.log(`Proxy :${listenPort} → 127.0.0.1:${targetPort} ${desc}`);
  });
  return server;
}

// Subdomain simulation: plain pass-through to port 3000
createProxy(8080, 3000);

// Subfolder simulation: strip /webgyb prefix, forward to port 3001
createProxy(8081, 3001, STRIP_PREFIX);

console.log('\nTest commands:');
console.log('  Subdomain : curl -si http://127.0.0.1:8080/');
console.log('  Subfolder : curl -si http://127.0.0.1:8081/webgyb/');
console.log('  API sub   : curl -s  http://127.0.0.1:8081/webgyb/api/accounts\n');
