/**
 * MEXC Bot Force Trade Helper
 * 
 * This script bypasses the UI and directly calls the bot's API
 * to force a trade regardless of market conditions.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Configuration - FIXED: Using port 3000 from .env file
const BOT_API_PORT = 3000;
const DEFAULT_SYMBOLS = [
  "C4EUSDT", "PONCHUSDT", "GLUTEUUSDT", "BLENDUSDT", "KCSUSDT",
  "WRLDUSDT", "BABYDOGE2USDT", "AGNTUSDT", "LOOPUSDT", "BURGERUSDT",
  "FILUSDT", "TRUMP1USDT", "ATTUSDT", "CELLUSDT", "SHIBAUSDT",
  "RAYUSDC", "GMEUSDT", "SEEDUSDT", "MEMESAIUSDT", "CATDOGUSDT"
];

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Serve index.html for root path
  if (req.url === '/' || req.url === '/index.html') {
    serveHtmlInterface(res);
    return;
  }
  
  // API to list available symbols
  if (req.url === '/symbols') {
    fetchAvailableSymbols((symbols) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ symbols }));
    });
    return;
  }
  
  // Handle force trade API request
  if (req.url === '/force-trade' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      let requestData = {};
      try {
        requestData = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      
      executeForceTradeRequest(requestData.symbol, (result) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
    });
    return;
  }
  
  // Status API
  if (req.url === '/status') {
    checkBotStatus((status) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    });
    return;
  }
  
  // Default 404 response
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Serve the HTML interface
function serveHtmlInterface(res) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Force Trade Helper</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #0f1721;
      color: #e9ecef;
    }
    h1, h2 {
      color: #75b6f3;
    }
    .card {
      background-color: #1a2332;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    button {
      background-color: #dc3545;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 10px;
    }
    button:hover {
      background-color: #c82333;
    }
    button:disabled {
      background-color: #6c757d;
      cursor: not-allowed;
    }
    select {
      width: 100%;
      padding: 10px;
      border-radius: 5px;
      background-color: #2c3344;
      color: white;
      border: 1px solid #3a4255;
      margin-bottom: 15px;
    }
    .status-message {
      margin-top: 15px;
      padding: 10px;
      border-radius: 5px;
    }
    .success {
      background-color: #054213;
      color: #98e49e;
    }
    .error {
      background-color: #5a0c14;
      color: #f8d7da;
    }
    .info {
      background-color: #055160;
      color: #d1ecf1;
    }
    .switch-container {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 60px;
      height: 30px;
      margin-right: 10px;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #2c3344;
      transition: .4s;
      border-radius: 30px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 22px;
      width: 22px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background-color: #0d6efd;
    }
    input:checked + .slider:before {
      transform: translateX(30px);
    }
    .bot-status {
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .connected {
      background-color: #054213;
    }
    .disconnected {
      background-color: #5a0c14;
    }
    .error-details {
      font-family: monospace;
      margin-top: 10px;
      padding: 10px;
      background-color: #2c3344;
      border-radius: 5px;
      white-space: pre-wrap;
      max-height: 100px;
      overflow-y: auto;
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <h1>MEXC Bot Force Trade Helper</h1>
  <div id="status-area" class="bot-status disconnected">
    Checking connection to bot...
  </div>
  
  <div class="card">
    <h2>Force Trade Options</h2>
    <div class="switch-container">
      <label class="switch">
        <input type="checkbox" id="specific-symbol-toggle">
        <span class="slider"></span>
      </label>
      <span>Use specific symbol</span>
    </div>
    
    <div id="symbol-select-container" style="display: none;">
      <label for="symbol-select">Select Symbol:</label>
      <select id="symbol-select">
        <option value="">Loading symbols...</option>
      </select>
    </div>
    
    <p><strong>Warning:</strong> This will execute a trade immediately regardless of market conditions!</p>
    <div class="actions">
      <button id="force-trade-btn" disabled>FORCE TRADE</button>
      <button id="retry-connection-btn">Retry Connection</button>
    </div>
    
    <div id="status-message" class="status-message" style="display: none;"></div>
    <div id="error-details" class="error-details" style="display: none;"></div>
  </div>
  
  <script>
    // DOM elements
    const statusArea = document.getElementById('status-area');
    const specificSymbolToggle = document.getElementById('specific-symbol-toggle');
    const symbolSelectContainer = document.getElementById('symbol-select-container');
    const symbolSelect = document.getElementById('symbol-select');
    const forceTradeBtn = document.getElementById('force-trade-btn');
    const retryConnectionBtn = document.getElementById('retry-connection-btn');
    const statusMessage = document.getElementById('status-message');
    const errorDetails = document.getElementById('error-details');
    
    // Check bot status on load
    checkBotStatus();
    
    // Load symbols
    fetchSymbols();
    
    // Event listeners
    specificSymbolToggle.addEventListener('change', function() {
      symbolSelectContainer.style.display = this.checked ? 'block' : 'none';
    });
    
    forceTradeBtn.addEventListener('click', executeForceTrade);
    retryConnectionBtn.addEventListener('click', checkBotStatus);
    
    // Functions
    function checkBotStatus() {
      // Update UI to show we're checking
      statusArea.textContent = 'Checking connection to bot...';
      statusArea.className = 'bot-status disconnected';
      forceTradeBtn.disabled = true;
      errorDetails.style.display = 'none';
      
      fetch('/status')
        .then(response => response.json())
        .then(data => {
          if (data.connected) {
            statusArea.textContent = 'Connected to MEXC Bot (Port 3000)';
            statusArea.className = 'bot-status connected';
            forceTradeBtn.disabled = false;
          } else {
            statusArea.textContent = 'Bot is unavailable. Check if it\'s running on port 3000';
            statusArea.className = 'bot-status disconnected';
            forceTradeBtn.disabled = true;
            
            if (data.error) {
              errorDetails.textContent = 'Error details: ' + data.error;
              errorDetails.style.display = 'block';
            }
          }
        })
        .catch(error => {
          statusArea.textContent = 'Error connecting to bot: ' + error.message;
          statusArea.className = 'bot-status disconnected';
          forceTradeBtn.disabled = true;
          errorDetails.textContent = 'Connection error: ' + error.message;
          errorDetails.style.display = 'block';
        });
    }
    
    function fetchSymbols() {
      fetch('/symbols')
        .then(response => response.json())
        .then(data => {
          // Clear dropdown
          symbolSelect.innerHTML = '';
          
          // Add symbols
          data.symbols.forEach(symbol => {
            const option = document.createElement('option');
            option.value = symbol;
            option.textContent = symbol;
            symbolSelect.appendChild(option);
          });
        })
        .catch(error => {
          console.error('Error fetching symbols:', error);
          // Add default symbols as fallback
          DEFAULT_SYMBOLS.forEach(symbol => {
            const option = document.createElement('option');
            option.value = symbol;
            option.textContent = symbol;
            symbolSelect.appendChild(option);
          });
        });
    }
    
    function executeForceTrade() {
      // Show confirmation dialog
      const useSpecificSymbol = specificSymbolToggle.checked;
      const symbol = useSpecificSymbol ? symbolSelect.value : null;
      const confirmMessage = useSpecificSymbol 
        ? 'Are you sure you want to force a trade for ' + symbol + '?'
        : 'Are you sure you want to force a random trade?';
        
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // Show spinner
      forceTradeBtn.disabled = true;
      forceTradeBtn.textContent = 'Executing...';
      statusMessage.style.display = 'none';
      errorDetails.style.display = 'none';
      
      // Prepare payload
      const payload = {};
      if (useSpecificSymbol && symbolSelect.value) {
        payload.symbol = symbolSelect.value;
      }
      
      // Call API
      fetch('/force-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error('Server responded with ' + response.status + ': ' + text);
          });
        }
        return response.json();
      })
      .then(result => {
        // Reset button
        forceTradeBtn.disabled = false;
        forceTradeBtn.textContent = 'FORCE TRADE';
        
        // Show result
        statusMessage.style.display = 'block';
        
        if (result.success || result.status.includes('executed') || result.status.includes('Trade executed')) {
          statusMessage.className = 'status-message success';
          statusMessage.textContent = 'Trade executed successfully for ' + (result.symbol || 'selected symbol');
        } else if (result.error) {
          statusMessage.className = 'status-message error';
          statusMessage.textContent = 'Error: ' + result.error;
          
          // Show details if available
          if (result.details) {
            errorDetails.textContent = JSON.stringify(result.details, null, 2);
            errorDetails.style.display = 'block';
          }
        } else {
          statusMessage.className = 'status-message info';
          statusMessage.textContent = result.status || 'Unknown response';
        }
        
        // Auto hide after 10 seconds
        setTimeout(() => {
          statusMessage.style.display = 'none';
        }, 10000);
      })
      .catch(error => {
        // Reset button
        forceTradeBtn.disabled = false;
        forceTradeBtn.textContent = 'FORCE TRADE';
        
        // Show error
        statusMessage.style.display = 'block';
        statusMessage.className = 'status-message error';
        statusMessage.textContent = 'Error executing trade: ' + error.message;
        
        // Show error details
        errorDetails.textContent = error.stack || error.message;
        errorDetails.style.display = 'block';
      });
    }
  </script>
</body>
</html>
  `;
  
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// Check if the bot is accessible
function checkBotStatus(callback) {
  const options = {
    hostname: 'localhost',
    port: BOT_API_PORT,
    path: '/api/status',
    method: 'GET',
    timeout: 3000 // 3 second timeout
  };
  
  console.log(`Checking bot status at http://localhost:${BOT_API_PORT}/api/status`);
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const parsedData = JSON.parse(data);
          callback({ 
            connected: true,
            botData: parsedData
          });
        } catch (e) {
          console.error('Error parsing response:', e);
          callback({ 
            connected: false, 
            error: 'Invalid JSON response from bot',
            statusCode: res.statusCode, 
            rawData: data
          });
        }
      } else {
        callback({ 
          connected: false, 
          statusCode: res.statusCode,
          error: `Bot returned status ${res.statusCode}`,
          rawData: data
        });
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('Error checking bot status:', error.message);
    callback({ 
      connected: false, 
      error: `Connection error: ${error.message}`
    });
  });
  
  req.on('timeout', () => {
    req.destroy();
    callback({ 
      connected: false, 
      error: 'Connection timeout - bot not responding'
    });
  });
  
  req.end();
}

// Get available symbols (try to get from bot or use defaults)
function fetchAvailableSymbols(callback) {
  const options = {
    hostname: 'localhost',
    port: BOT_API_PORT,
    path: '/api/market',
    method: 'GET',
    timeout: 3000
  };
  
  console.log(`Fetching symbols from http://localhost:${BOT_API_PORT}/api/market`);
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const responseData = JSON.parse(data);
          if (responseData.data && typeof responseData.data === 'object') {
            const symbols = Object.keys(responseData.data);
            if (symbols.length > 0) {
              console.log(`Found ${symbols.length} symbols from bot API`);
              callback(symbols);
              return;
            }
          }
        } catch (e) {
          console.error('Error parsing symbols response:', e);
        }
      } else {
        console.error(`Error fetching symbols: Server returned ${res.statusCode}`);
      }
      
      // If we get here, there was an issue - try config/symbols list endpoint
      fetchSymbolsFromConfig(callback);
    });
  });
  
  req.on('error', (error) => {
    console.error('Error fetching symbols:', error.message);
    fetchSymbolsFromConfig(callback);
  });
  
  req.on('timeout', () => {
    req.destroy();
    console.error('Timeout fetching symbols');
    fetchSymbolsFromConfig(callback);
  });
  
  req.end();
}

// Alternative method to get symbols from bot config
function fetchSymbolsFromConfig(callback) {
  const options = {
    hostname: 'localhost',
    port: BOT_API_PORT,
    path: '/api/config',
    method: 'GET',
    timeout: 3000
  };
  
  console.log(`Trying to fetch symbols from config at http://localhost:${BOT_API_PORT}/api/config`);
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const responseData = JSON.parse(data);
          if (responseData.config && Array.isArray(responseData.config.symbolList)) {
            const symbols = responseData.config.symbolList;
            if (symbols.length > 0) {
              console.log(`Found ${symbols.length} symbols from config`);
              callback(symbols);
              return;
            }
          }
        } catch (e) {
          console.error('Error parsing config response:', e);
        }
      }
      
      // If we get here, all attempts failed - use default symbols
      console.log('Using default symbols as fallback');
      callback(DEFAULT_SYMBOLS);
    });
  });
  
  req.on('error', (error) => {
    console.error('Error fetching config:', error.message);
    callback(DEFAULT_SYMBOLS);
  });
  
  req.on('timeout', () => {
    req.destroy();
    callback(DEFAULT_SYMBOLS);
  });
  
  req.end();
}

// Execute force trade request
function executeForceTradeRequest(symbol, callback) {
  // Properly format payload to match what the bot expects
  const payload = {};
  if (symbol) {
    payload.symbol = symbol;
  }
  
  const postData = JSON.stringify(payload);
  
  console.log(`Executing force trade request${symbol ? ' for '+symbol : ''}`);
  
  const options = {
    hostname: 'localhost',
    port: BOT_API_PORT,
    path: '/api/force-trade',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 10000 // 10 second timeout for trade execution
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`Force trade response: HTTP ${res.statusCode}`);
      
      try {
        // Always try to parse the response as JSON
        let result;
        try {
          result = JSON.parse(data);
        } catch (e) {
          // If parsing fails, create a result with the raw data
          result = { 
            success: false, 
            error: 'Invalid JSON response',
            rawResponse: data
          };
        }
        
        // Analyze the result to determine if it was successful
        if (res.statusCode === 200) {
          if (result.status && result.status.includes('executed')) {
            // Bot returned success message
            callback({ 
              success: true, 
              symbol: result.symbol || symbol, 
              status: result.status,
              details: result
            });
          } else {
            // Bot returned a 200 response but without success confirmation
            callback({ 
              success: false, 
              error: result.error || 'Unknown response from bot',
              status: result.status || 'Unknown status',
              details: result
            });
          }
        } else {
          // Non-200 status code
          callback({ 
            success: false, 
            error: `Server returned ${res.statusCode}: ${result.error || 'Unknown error'}`,
            details: result
          });
        }
      } catch (e) {
        callback({ 
          success: false, 
          error: 'Error processing response: ' + e.message,
          rawResponse: data
        });
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('Error executing force trade:', error.message);
    callback({ 
      success: false, 
      error: 'Connection error: ' + error.message
    });
  });
  
  req.on('timeout', () => {
    req.destroy();
    callback({ 
      success: false, 
      error: 'Request timeout - bot not responding'
    });
  });
  
  // Write payload and end request
  req.write(postData);
  req.end();
}

// Start the server
const PORT = 3500;
server.listen(PORT, () => {
  console.log(`
========================================================
  MEXC Bot Force Trade Helper (FIXED VERSION)
========================================================
  Open your browser and visit:
  
  http://localhost:${PORT}/
  
  This tool helps you execute forced trades with the bot,
  even when the original UI isn't working properly.
  
  Bot connection details:
  - Looking for bot at: http://localhost:${BOT_API_PORT}/api/status
  - Using improved error reporting and fallbacks
========================================================
`);
});
