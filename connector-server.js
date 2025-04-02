/**
 * Connector Server for MEXC Trading Bot Dashboard
 * 
 * This server serves the dashboard connector HTML and
 * facilitates communication with the bot running on port 3001
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Port for this connector server (different from the bot's port)
const PORT = 3002;
// Bot API server port
const BOT_PORT = 3001;

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Function to proxy API requests to the bot server
function proxyRequest(req, res) {
  const options = {
    hostname: 'localhost',
    port: BOT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  // Remove host header to avoid conflicts
  delete options.headers.host;
  
  const proxyReq = http.request(options, (proxyRes) => {
    // Add CORS headers to allow cross-origin requests
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    // Pipe the response from the bot server to the client
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (error) => {
    console.error(`Proxy request error: ${error.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bot server unavailable', details: error.message }));
  });
  
  // Pipe the request body from the client to the bot server
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400' // 24 hours
    });
    res.end();
    return;
  }
  
  // Proxy API requests to the bot server
  if (pathname.startsWith('/api/')) {
    proxyRequest(req, res);
    return;
  }
  
  // For direct access to the bot's dashboard
  if (pathname === '/bot-dashboard') {
    res.writeHead(302, { 'Location': `http://localhost:${BOT_PORT}` });
    res.end();
    return;
  }
  
  // Serve the connector HTML file at the root path
  let filePath = pathname === '/' ? '/mexc-bot-dashboard-3001.html' : pathname;
  
  // Get the file extension
  const extname = path.extname(filePath);
  
  // Set default content type to HTML
  let contentType = MIME_TYPES[extname] || 'text/html';
  
  // Handle the root connector HTML file
  if (filePath === '/mexc-bot-dashboard-3001.html') {
    filePath = path.join(__dirname, 'mexc-bot-dashboard-3001.html');
  } else {
    // For other static files, look in the current directory
    filePath = path.join(__dirname, filePath);
  }
  
  // Read and serve the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        console.error(`File not found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        
        // Send a more user-friendly 404 page
        res.end(`
          <html>
            <head>
              <title>404 - File Not Found</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #d9534f; }
                .container { max-width: 600px; margin: 0 auto; }
                .button { display: inline-block; background: #0275d8; color: white; padding: 10px 20px; 
                          text-decoration: none; border-radius: 5px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>404 - File Not Found</h1>
                <p>The file you requested could not be found on this server.</p>
                <p>Please check the URL or return to the home page.</p>
                <a href="/" class="button">Go to Dashboard Connector</a>
                <a href="/bot-dashboard" class="button">Go to Bot Dashboard</a>
              </div>
            </body>
          </html>
        `);
      } else {
        // Server error
        console.error(`Server error: ${err.code}`);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head>
              <title>500 - Server Error</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #d9534f; }
                .container { max-width: 600px; margin: 0 auto; }
                pre { text-align: left; background: #f8f9fa; padding: 15px; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>500 - Server Error</h1>
                <p>An internal server error occurred:</p>
                <pre>${err.code}: ${err.message}</pre>
                <p>Please try again later or contact support.</p>
              </div>
            </body>
          </html>
        `);
      }
    } else {
      // Success - add CORS headers to all responses
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`
============================================================
 MEXC Trading Bot Dashboard Connector
============================================================
 Server running at http://localhost:${PORT}/
 
 This server provides:
 - Dashboard connector interface: http://localhost:${PORT}/
 - Direct access to bot dashboard: http://localhost:${PORT}/bot-dashboard
 - API proxy to bot server on port ${BOT_PORT}
 
 Open your browser to access the connector interface
============================================================
`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down connector server...');
  server.close(() => {
    console.log('Connector server closed');
    process.exit(0);
  });
});
