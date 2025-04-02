/**
 * Simple HTTP server to serve the trading bot dashboard
 * 
 * This standalone server doesn't require any dependencies
 * and can be used to view the dashboard interface
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Port for the web server
const PORT = 3000;

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

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Default to serving the dashboard
  let filePath = req.url === '/' ? '/dashboard.html' : req.url;
  
  // Get the file extension
  const extname = path.extname(filePath);
  
  // Set default content type to HTML
  let contentType = MIME_TYPES[extname] || 'text/html';
  
  // Resolve the file path relative to the current directory
  filePath = path.join(__dirname, filePath);
  
  // Read and serve the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        console.error(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end('404 File Not Found');
      } else {
        // Server error
        console.error(`Server error: ${err.code}`);
        res.writeHead(500);
        res.end(`500 Internal Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Open your browser to view the trading bot dashboard`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
