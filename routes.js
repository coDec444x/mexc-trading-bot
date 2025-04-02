const express = require('express');

/**
 * Create and configure API routes for the trading bot
 * @param {Object} tradingBot - Reference to the main trading bot instance
 * @returns {express.Router} - Configured Express router
 */
function createApiRoutes(tradingBot) {
  const router = express.Router();
  
  /**
   * Get bot status
   * GET /api/status
   */
  router.get('/status', (req, res) => {
    try {
      const status = tradingBot.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get all open positions
   * GET /api/positions
   */
  router.get('/positions', (req, res) => {
    try {
      const positions = tradingBot.getOpenPositions();
      res.json({ positions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get position history (closed positions)
   * GET /api/positions/history
   */
  router.get('/positions/history', (req, res) => {
    try {
      const history = tradingBot.getPositionHistory();
      res.json({ history });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get specific position
   * GET /api/positions/:symbol
   */
  router.get('/positions/:symbol', (req, res) => {
    try {
      const { symbol } = req.params;
      const position = tradingBot.getPosition(symbol);
      
      if (!position) {
        return res.status(404).json({ error: `No position found for ${symbol}` });
      }
      
      res.json({ position });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get market data for a specific symbol
   * GET /api/market/:symbol
   */
  router.get('/market/:symbol', (req, res) => {
    try {
      const { symbol } = req.params;
      const marketData = tradingBot.getMarketData(symbol);
      
      if (!marketData) {
        return res.status(404).json({ error: `No data found for ${symbol}` });
      }
      
      res.json({ symbol, data: marketData });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get market data for all symbols
   * GET /api/market
   */
  router.get('/market', (req, res) => {
    try {
      const marketData = tradingBot.getAllMarketData();
      res.json({ data: marketData });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get current configuration
   * GET /api/config
   */
  router.get('/config', (req, res) => {
    try {
      const config = tradingBot.getConfig();
      res.json({ config });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Force a trade analysis
   * POST /api/force-trade
   * Optional body: { symbol: "specific-symbol" }
   */
  router.post('/force-trade', async (req, res) => {
    try {
      const symbol = req.body?.symbol;
      const result = await tradingBot.executeForcedTrade(symbol);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Close a position
   * POST /api/positions/:symbol/close
   */
  router.post('/positions/:symbol/close', async (req, res) => {
    try {
      const { symbol } = req.params;
      const result = await tradingBot.closePosition(symbol);
      
      if (!result) {
        return res.status(404).json({ error: `No position found for ${symbol}` });
      }
      
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Pause/resume bot trading
   * POST /api/control
   * Body: { action: "pause" | "resume" }
   */
  router.post('/control', (req, res) => {
    try {
      const { action } = req.body;
      
      if (action === 'pause') {
        tradingBot.pause();
        res.json({ success: true, status: 'paused' });
      } else if (action === 'resume') {
        tradingBot.resume();
        res.json({ success: true, status: 'running' });
      } else {
        res.status(400).json({ error: 'Invalid action. Use "pause" or "resume".' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}

module.exports = createApiRoutes;
