const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  let filePath;

  if (url.pathname.startsWith('/dist/')) {
    // Serve dist/ from project root
    filePath = path.join(root, url.pathname);
  } else if (url.pathname.startsWith('/fixtures/')) {
    // Serve test fixtures for URL validation tests
    filePath = path.join(root, 'tests', 'examples', url.pathname.replace('/fixtures/', ''));
  } else {
    // Serve website/ files
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    filePath = path.join(root, 'website', relative);
  }

  // Prevent path traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(resolved);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(resolved, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
