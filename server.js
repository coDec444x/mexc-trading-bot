const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'web.log' })
  ]
});

/**
 * Web Server class for the trading bot
 */
class WebServer {
  /**
   * Constructor
   * @param {Object} config - Configuration object
   * @param {Object} tradingBot - Reference to the main trading bot instance
   */
  constructor(config, tradingBot) {
    this.config = config;
    this.tradingBot = tradingBot;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server);
    this.running = false;
    
    this.setupExpress();
    this.setupRoutes();
    this.setupWebSockets();
  }

  /**
   * Configure Express middleware
   */
  setupExpress() {
    // Parse JSON request bodies
    this.app.use(express.json());
    
    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Basic request logging
    this.app.use((req, res, next) => {
      logger.info(`[WEB] ${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * Set up API routes
   */
  setupRoutes() {
    // Status endpoint - get overall bot status
    this.app.get('/api/status', (req, res) => {
      try {
        const status = this.tradingBot.getStatus();
        res.json(status);
      } catch (error) {
        logger.error(`[STATUS API] ${error.message}`);
        res.status(500).json({ error: 'Failed to get bot status' });
      }
    });
    
    // Positions endpoint - get current open positions
    this.app.get('/api/positions', (req, res) => {
      try {
        const positions = this.tradingBot.getOpenPositions();
        res.json({ positions });
      } catch (error) {
        logger.error(`[POSITIONS API] ${error.message}`);
        res.status(500).json({ error: 'Failed to get positions' });
      }
    });
    
    // Market data endpoint - get latest market data for a symbol
    this.app.get('/api/market/:symbol', (req, res) => {
      try {
        const { symbol } = req.params;
        const marketData = this.tradingBot.getMarketData(symbol);
        
        if (!marketData) {
          return res.status(404).json({ error: `No data found for symbol ${symbol}` });
        }
        
        res.json({ symbol, data: marketData });
      } catch (error) {
        logger.error(`[MARKET API] ${error.message}`);
        res.status(500).json({ error: 'Failed to get market data' });
      }
    });
    
    // Config endpoint - get current configuration
    this.app.get('/api/config', (req, res) => {
      try {
        // Send non-sensitive config info
        const config = this.config.getConfig();
        res.json({ config });
      } catch (error) {
        logger.error(`[CONFIG API] ${error.message}`);
        res.status(500).json({ error: 'Failed to get configuration' });
      }
    });
    
    // Force trade endpoint - manually trigger a trade analysis
    this.app.post('/api/force-trade', async (req, res) => {
      try {
        logger.info('[FORCE TRADE] Manual trade execution requested');
        const result = await this.tradingBot.executeForcedTrade();
        res.json(result);
      } catch (error) {
        logger.error(`[FORCE TRADE API] ${error.message}`);
        res.status(500).json({ error: 'Failed to execute forced trade' });
      }
    });
    
    // Root endpoint - serve the dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    // 404 handler for unknown routes
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Set up WebSocket communication
   */
  setupWebSockets() {
    this.io.on('connection', (socket) => {
      logger.info(`[WEBSOCKET] Client connected: ${socket.id}`);
      
      // Send initial data on connection
      this.sendInitialData(socket);
      
      // Handle client events
      socket.on('disconnect', () => {
        logger.info(`[WEBSOCKET] Client disconnected: ${socket.id}`);
      });
      
      // Other real-time event handlers can be added here
    });
  }

  /**
   * Send initial data to a newly connected WebSocket client
   * @param {Object} socket - Socket.io socket
   */
  sendInitialData(socket) {
    try {
      const status = this.tradingBot.getStatus();
      const positions = this.tradingBot.getOpenPositions();
      
      socket.emit('initial_data', {
        status,
        positions
      });
    } catch (error) {
      logger.error(`[WEBSOCKET] Error sending initial data: ${error.message}`);
    }
  }

  /**
   * Broadcast a market update to all connected clients
   * @param {Object} update - Market update data
   */
  broadcastMarketUpdate(update) {
    this.io.emit('market_update', update);
  }

  /**
   * Broadcast a position update to all connected clients
   * @param {Object} update - Position update data
   */
  broadcastPositionUpdate(update) {
    this.io.emit('position_update', update);
  }

  /**
   * Start the web server
   * @returns {Promise<boolean>} - Success status
   */
  async start() {
    if (this.running) return true;
    
    try {
      await new Promise(resolve => {
        this.server.listen(this.config.port, '0.0.0.0', () => {
          this.running = true;
          logger.info(`[WEB] Server started on port ${this.config.port}`);
          resolve();
        });
      });
      
      return true;
    } catch (error) {
      logger.error(`[WEB] Failed to start server: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop the web server
   * @returns {Promise<boolean>} - Success status
   */
  async stop() {
    if (!this.running) return true;
    
    try {
      await new Promise(resolve => {
        this.server.close(() => {
          this.running = false;
          logger.info('[WEB] Server stopped');
          resolve();
        });
      });
      
      return true;
    } catch (error) {
      logger.error(`[WEB] Failed to stop server: ${error.message}`);
      return false;
    }
  }
}

module.exports = WebServer;
