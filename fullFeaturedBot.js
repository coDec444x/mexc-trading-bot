// Entry point for the MEXC Trading Bot
const winston = require('winston');
const axios = require('axios');
const config = require('./config/config');
const mexcApi = require('./api/mexcApi');
const PositionManager = require('./risk/management');
const MultiSignalStrategy = require('./strategies/multiSignal');
const WebServer = require('./web/server');
const fs = require('fs');
const path = require('path');

// Configure global logger
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
    new winston.transports.File({ filename: 'bot.log' })
  ]
});

/**
 * Main Trading Bot class
 */
class TradingBot {
  constructor() {
    this.config = config;
    this.mexcApi = mexcApi;
    this.positionManager = new PositionManager(config, mexcApi);
    this.strategy = new MultiSignalStrategy(config);
    this.webServer = new WebServer(config, this);
    
    this.marketDataCache = {};
    this.symbolInfoCache = null;
    this.runningInterval = null;
    this.closedPositions = [];
    
    // Safety features
    this.killSwitchActivated = false;
    this.maxPositionSize = 10; // Maximum position size in USDT
    this.dailyLossLimit = -10; // Daily loss limit in percent
    this.dailyStartBalance = config.accountBalance;
    this.dailyPnL = 0;
    this.lastResetDay = new Date().getUTCDate();
    
    this.status = {
      running: false,
      dryRun: config.dryRun,
      uptime: 0,
      startTime: null,
      totalTrades: 0,
      winRate: 0,
      totalProfitLoss: 0,
      accountBalance: config.accountBalance,
      bestTrade: null,
      activePairsCount: 0,
      totalPairsCount: config.symbolList.length,
      safetyStatus: {
        killSwitch: false,
        dailyLossLimitReached: false,
        maxPositionSizeLimit: this.maxPositionSize
      }
    };
  }

  /**
   * Initialize the trading bot
   */
  async initialize() {
    logger.info('[BOT] Initializing MEXC Trading Bot');
    logger.info(`[CONFIG] Dry Run: ${this.config.dryRun}`);
    
    try {
      // Initialize exchange information
      await this.getExchangeInfo();
      
      // Initialize position manager
      const positions = this.positionManager.getOpenPositions();
      logger.info(`[POSITIONS] ${Object.keys(positions).length} open positions found`);
      
      // Start web server
      await this.webServer.start();
      
      return true;
    } catch (error) {
      logger.error(`[INIT ERROR] ${error.message}`);
      return false;
    }
  }

  /**
   * Activate kill switch to immediately stop all trading activity
   * @returns {boolean} Success status
   */
  activateKillSwitch() {
    logger.warn('[SAFETY] Kill switch activated - stopping all trading activity');
    this.killSwitchActivated = true;
    this.status.safetyStatus.killSwitch = true;
    
    // Pause the bot
    this.pause();
    
    return true;
  }

  /**
   * Deactivate kill switch
   * @returns {boolean} Success status
   */
  deactivateKillSwitch() {
    logger.info('[SAFETY] Kill switch deactivated');
    this.killSwitchActivated = false;
    this.status.safetyStatus.killSwitch = false;
    return true;
  }

  /**
   * Set maximum position size
   * @param {number} sizeInUsdt - Maximum position size in USDT
   * @returns {boolean} Success status
   */
  setMaxPositionSize(sizeInUsdt) {
    if (sizeInUsdt <= 0) {
      logger.error('[SAFETY] Invalid maximum position size');
      return false;
    }
    
    this.maxPositionSize = sizeInUsdt;
    this.status.safetyStatus.maxPositionSizeLimit = sizeInUsdt;
    logger.info(`[SAFETY] Maximum position size set to ${sizeInUsdt} USDT`);
    return true;
  }

  /**
   * Set daily loss limit
   * @param {number} percentLimit - Daily loss limit in percent (negative number)
   * @returns {boolean} Success status
   */
  setDailyLossLimit(percentLimit) {
    if (percentLimit >= 0) {
      logger.error('[SAFETY] Daily loss limit must be a negative number');
      return false;
    }
    
    this.dailyLossLimit = percentLimit;
    logger.info(`[SAFETY] Daily loss limit set to ${percentLimit}%`);
    return true;
  }

  /**
   * Close all positions (emergency exit)
   * @returns {Promise<Array>} Closed positions
   */
  async emergencyCloseAllPositions() {
    logger.warn('[SAFETY] Emergency closing all positions');
    
    const openPositions = this.positionManager.getOpenPositions();
    const symbols = Object.keys(openPositions);
    const closedPositions = [];
    
    for (const symbol of symbols) {
      try {
        const position = await this.closePosition(symbol);
        if (position) {
          closedPositions.push(position);
        }
      } catch (error) {
        logger.error(`[SAFETY] Error closing position for ${symbol}: ${error.message}`);
      }
    }
    
    logger.info(`[SAFETY] Emergency closed ${closedPositions.length}/${symbols.length} positions`);
    return closedPositions;
  }

  /**
   * Check daily loss limit
   * @returns {boolean} True if limit is reached
   */
  checkDailyLossLimit() {
    // Reset daily PnL if day has changed
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastResetDay) {
      this.dailyStartBalance = this.status.accountBalance;
      this.dailyPnL = 0;
      this.lastResetDay = currentDay;
      this.status.safetyStatus.dailyLossLimitReached = false;
    }
    
    // Calculate daily PnL percentage
    const pnlPercent = (this.dailyPnL / this.dailyStartBalance) * 100;
    
    // Check if limit reached
    if (pnlPercent <= this.dailyLossLimit) {
      if (!this.status.safetyStatus.dailyLossLimitReached) {
        logger.warn(`[SAFETY] Daily loss limit reached: ${pnlPercent.toFixed(2)}% (limit: ${this.dailyLossLimit}%)`);
        this.status.safetyStatus.dailyLossLimitReached = true;
        this.pause();
      }
      return true;
    }
    
    return false;
  }

  /**
   * Start the trading bot
   */
  async start() {
    if (this.status.running) {
      logger.warn('[BOT] Trading bot is already running');
      return false;
    }
    
    // Safety checks before starting
    if (this.killSwitchActivated) {
      logger.error('[SAFETY] Cannot start bot: Kill switch is activated');
      return false;
    }
    
    if (this.status.safetyStatus.dailyLossLimitReached) {
      logger.error('[SAFETY] Cannot start bot: Daily loss limit reached');
      return false;
    }
    
    this.status.running = true;
    this.status.startTime = new Date();
    this.startUptimeCounter();
    
    logger.info('[BOT] Starting trading bot');
    logger.info(`[BOT] Monitoring ${this.config.symbolList.length} symbols`);
    
    // Run initial market data update
    await this.updateAllMarketData();
    
    // Start the main trading loop
    this.runningInterval = setInterval(async () => {
      if (!this.status.running) return;
      
      try {
        await this.mainLoop();
      } catch (error) {
        logger.error(`[MAIN LOOP ERROR] ${error.message}`);
      }
    }, 60000); // Run every minute
    
    return true;
  }

  /**
   * Pause the trading bot
   */
  pause() {
    if (!this.status.running) {
      logger.warn('[BOT] Trading bot is already paused');
      return false;
    }
    
    this.status.running = false;
    logger.info('[BOT] Trading bot paused');
    return true;
  }

  /**
   * Resume the trading bot
   */
  resume() {
    if (this.status.running) {
      logger.warn('[BOT] Trading bot is already running');
      return false;
    }
    
    // Safety checks before resuming
    if (this.killSwitchActivated) {
      logger.error('[SAFETY] Cannot resume bot: Kill switch is activated');
      return false;
    }
    
    if (this.status.safetyStatus.dailyLossLimitReached) {
      logger.error('[SAFETY] Cannot resume bot: Daily loss limit reached');
      return false;
    }
    
    this.status.running = true;
    logger.info('[BOT] Trading bot resumed');
    return true;
  }

  /**
   * Stop the trading bot
   */
  async stop() {
    this.status.running = false;
    
    if (this.runningInterval) {
      clearInterval(this.runningInterval);
      this.runningInterval = null;
    }
    
    await this.webServer.stop();
    logger.info('[BOT] Trading bot stopped');
    return true;
  }

  /**
   * Main trading loop
   */
  async mainLoop() {
    logger.info('[UPDATE] ' + new Date().toISOString());
    
    try {
      // Check safety features
      this.checkDailyLossLimit();
      
      // If safety features have stopped the bot, don't continue
      if (!this.status.running) {
        return;
      }
      
      // Update market data for all symbols
      await this.updateAllMarketData();
      
      // Update position status
      await this.positionManager.updatePositions(this.marketDataCache);
      
      // Run strategy on each symbol
      for (const symbol of this.config.symbolList) {
        await this.processSymbol(symbol);
      }
      
    } catch (error) {
      logger.error(`[MAIN LOOP ERROR] ${error.message}`);
    }
  }

  /**
   * Process a single symbol
   * @param {string} symbol - Symbol to process
   */
  async processSymbol(symbol) {
    // Skip if we already have an open position for this symbol
    if (this.positionManager.hasOpenPosition(symbol)) {
      return;
    }
    
    // Skip if we don't have market data
    const marketData = this.marketDataCache[symbol];
    if (!marketData || !marketData.prices || marketData.prices.length < 50) {
      logger.debug(`[${symbol}] Insufficient market data for analysis`);
      return;
    }
    
    // Analyze market data with strategy
    const analysis = this.strategy.analyze(symbol, marketData);
    
    // If we have a buy signal, open a position
    if (analysis.signal === 'BUY') {
      try {
        await this.openPosition(symbol, analysis);
      } catch (error) {
        logger.error(`[${symbol}] Error opening position: ${error.message}`);
      }
    }
  }

  /**
   * Open a new position based on strategy signal
   * @param {string} symbol - Symbol to trade
   * @param {Object} analysis - Strategy analysis result
   */
  async openPosition(symbol, analysis) {
    const marketData = this.marketDataCache[symbol];
    const currentPrice = marketData.prices[marketData.prices.length - 1];
    
    // Calculate position size
    let positionSize = this.strategy.calculatePositionSize(
      symbol, 
      this.config.accountBalance, 
      this.config.riskPercent,
      marketData
    );
    
    // Apply maximum position size limit (safety feature)
    if (positionSize > this.maxPositionSize) {
      logger.info(`[SAFETY] Position size ${positionSize.toFixed(2)} USDT reduced to maximum ${this.maxPositionSize} USDT`);
      positionSize = this.maxPositionSize;
    }
    
    logger.info(`[${symbol}] Opening position. Signal strength: ${analysis.score}/5, USDT: ${positionSize.toFixed(2)}`);
    
    try {
      // Execute market buy
      const buyResult = await this.mexcApi.placeMarketBuy(symbol, positionSize);
      
      // Extract trade details
      const avgPrice = parseFloat(buyResult.fills?.[0]?.price || currentPrice);
      const quantity = parseFloat(buyResult.executedQty || (positionSize / currentPrice));
      
      // Open position in position manager
      const position = this.positionManager.openPosition(symbol, avgPrice, quantity, marketData);
      
      // Update statistics
      this.status.totalTrades++;
      
      // Broadcast position update to websocket clients
      this.webServer.broadcastPositionUpdate({
        action: 'OPEN',
        position
      });
      
      return position;
    } catch (error) {
      logger.error(`[${symbol}] Error executing buy order: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close an existing position
   * @param {string} symbol - Symbol to close position for
   */
  async closePosition(symbol) {
    try {
      // Get current price
      const marketData = this.marketDataCache[symbol];
      const currentPrice = marketData?.prices?.[marketData.prices.length - 1];
      
      // Close position
      const position = await this.positionManager.closePosition(symbol, currentPrice, 'MANUAL_CLOSE');
      
      if (position) {
        // Add to closed positions history
        this.closedPositions.push(position);
        
        // Update daily PnL
        if (position.profits) {
          this.dailyPnL += position.profits.raw;
        }
        
        // Update statistics
        this.updateStatistics();
        
        // Broadcast position update to websocket clients
        this.webServer.broadcastPositionUpdate({
          action: 'CLOSE',
          position
        });
        
        return position;
      }
      
      return null;
    } catch (error) {
      logger.error(`[${symbol}] Error closing position: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Force a trade execution - truly forces a trade regardless of market conditions
   * @param {string} [symbol] - Optional specific symbol to trade
   */
  async executeForcedTrade(symbol) {
    logger.info(`[FORCE TRADE] Executing forced trade${symbol ? ` for ${symbol}` : ''}`);
    
    // Safety checks
    if (this.killSwitchActivated) {
      return { status: 'Failed: Kill switch is activated' };
    }
    
    if (this.status.safetyStatus.dailyLossLimitReached) {
      return { status: 'Failed: Daily loss limit reached' };
    }
    
    try {
      // If no specific symbol is provided, pick one randomly from the available symbols
      if (!symbol) {
        const availableSymbols = this.config.symbolList.filter(sym => 
          !this.positionManager.hasOpenPosition(sym)
        );
        
        if (availableSymbols.length === 0) {
          return { status: 'No available symbols - all have open positions' };
        }
        
        // Randomly select a symbol
        const randomIndex = Math.floor(Math.random() * availableSymbols.length);
        symbol = availableSymbols[randomIndex];
        logger.info(`[FORCE TRADE] Randomly selected symbol: ${symbol}`);
      }
      
      // Check if we already have a position for this symbol
      if (this.positionManager.hasOpenPosition(symbol)) {
        return { status: `Position already exists for ${symbol}` };
      }
      
      // Create a mock market data if we don't have it
      let marketData = this.marketDataCache[symbol];
      if (!marketData || !marketData.prices || marketData.prices.length < 2) {
        // Get the current price from the exchange or use a default
        let currentPrice = 100; // Default fallback price
        
        try {
          // Try to get real price data (single price) if possible
          const priceData = await this.getMarketData(symbol, 1);
          if (priceData && priceData.length > 0) {
            currentPrice = priceData[0];
          }
        } catch (e) {
          logger.warn(`[FORCE TRADE] Could not get price for ${symbol}, using default: ${e.message}`);
        }
        
        // Create minimal market data
        marketData = {
          symbol,
          timestamp: new Date().toISOString(),
          prices: [currentPrice, currentPrice], // Just need something non-empty
          indicators: {}
        };
      }
      
      // Create a basic analysis object
      const forcedAnalysis = {
        symbol,
        signal: 'FORCE_BUY',
        score: 5, // Max score for forced trade
        reason: 'Manually forced trade'
      };
      
      // Calculate position size - use a fixed percentage of account balance
      // or use the configured risk percent
      const forceTradeRiskPercent = 1; // 1% of account for forced trades
      const positionSize = (this.status.accountBalance * forceTradeRiskPercent) / 100;
      
      logger.info(`[FORCE TRADE] Executing forced buy for ${symbol}. USDT: ${positionSize.toFixed(2)}`);
      
      // Execute the buy - need special handling for forced trade
      try {
        // Execute market buy
        const buyResult = await this.mexcApi.placeMarketBuy(symbol, positionSize);
        
        // Extract trade details
        const currentPrice = marketData.prices[marketData.prices.length - 1];
        const avgPrice = parseFloat(buyResult.fills?.[0]?.price || currentPrice);
        const quantity = parseFloat(buyResult.executedQty || (positionSize / currentPrice));
        
        // Open position in position manager
        const position = this.positionManager.openPosition(symbol, avgPrice, quantity, marketData);
        
        // Update statistics
        this.status.totalTrades++;
        
        // Broadcast position update to websocket clients
        this.webServer.broadcastPositionUpdate({
          action: 'OPEN',
          position
        });
        
        return {
          status: 'Trade executed successfully (FORCED)',
          symbol,
          position
        };
      } catch (error) {
        logger.error(`[FORCE TRADE] Error executing buy order: ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`[FORCE TRADE ERROR] ${error.message}`);
      throw error;
    }
  }

  /**
   * Update market data for all symbols
   */
  async updateAllMarketData() {
    const promises = this.config.symbolList.map(symbol => this.updateMarketData(symbol));
    await Promise.allSettled(promises);
    
    // Update active pairs count
    this.status.activePairsCount = Object.keys(this.marketDataCache).length;
  }

  /**
   * Update market data for a specific symbol
   * @param {string} symbol - Symbol to update market data for
   */
  async updateMarketData(symbol) {
    try {
      // Get historical price data
      const prices = await this.getMarketData(symbol);
      
      if (!prices || prices.length < 50) {
        logger.debug(`[${symbol}] Insufficient price data`);
        return;
      }
      
      // Calculate indicators
      const marketData = {
        symbol,
        timestamp: new Date().toISOString(),
        prices,
        indicators: {
          ma5: this.calcMA(prices, 5),
          ma20: this.calcMA(prices, 20),
          rsi14: this.calcRSI(prices, 14),
          macd: this.calcMACD(prices),
          bollinger: this.calcBollingerBands(prices),
          stochastic: this.calcStochastic(prices)
        }
      };
      
      // Update market data cache
      this.marketDataCache[symbol] = marketData;
      
      // Broadcast market update to websocket clients
      this.webServer.broadcastMarketUpdate({
        symbol,
        data: marketData
      });
      
      return marketData;
    } catch (error) {
      logger.error(`[${symbol}] Error updating market data: ${error.message}`);
    }
  }

  /**
   * Get market data for a symbol
   * @param {string} symbol - Symbol to get market data for
   * @param {number} [limit=200] - Number of candles to fetch
   * @param {string} [interval='1m'] - Candle interval
   * @returns {Promise<number[]>} - Array of closing prices
   */
  async getMarketData(symbol, limit = 200, interval = '1m') {
    try {
      if (this.config.dryRun) {
        // Generate mock data in dry run mode
        return this.generateMockPrices(limit);
      }
      
      const url = `${this.config.baseUrl}/api/v3/klines`;
      const response = await axios.get(url, {
        params: { symbol, interval, limit }
      });
      
      // Extract closing prices from klines response
      return response.data.map(candle => parseFloat(candle[4]));
    } catch (error) {
      logger.error(`[${symbol}] Error fetching market data: ${error.message}`);
      return null;
    }
  }

  /**
   * Get exchange information
   */
  async getExchangeInfo() {
    if (this.symbolInfoCache) return this.symbolInfoCache;
    
    try {
      if (this.config.dryRun) {
        // Generate mock exchange info in dry run mode
        this.symbolInfoCache = { symbols: [] };
        return this.symbolInfoCache;
      }
      
      const exchangeInfo = await this.mexcApi.getExchangeInfo();
      this.symbolInfoCache = exchangeInfo;
      return exchangeInfo;
    } catch (error) {
      logger.error(`[EXCHANGE INFO] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the bot status
   * @returns {Object} - Bot status
   */
  getStatus() {
    return { ...this.status };
  }

  /**
   * Get all open positions
   * @returns {Object} - Open positions
   */
  getOpenPositions() {
    return this.positionManager.getOpenPositions();
  }

  /**
   * Get position history
   * @returns {Array} - Position history
   */
  getPositionHistory() {
    return [...this.closedPositions];
  }

  /**
   * Get specific position
   * @param {string} symbol - Symbol to get position for
   * @returns {Object|null} - Position or null if not found
   */
  getPosition(symbol) {
    return this.positionManager.getOpenPositions()[symbol] || null;
  }

  /**
   * Get market data for a specific symbol
   * @param {string} symbol - Symbol to get market data for
   * @returns {Object|null} - Market data or null if not found
   */
  getMarketData(symbol) {
    return this.marketDataCache[symbol] || null;
  }

  /**
   * Get all market data
   * @returns {Object} - All market data
   */
  getAllMarketData() {
    return { ...this.marketDataCache };
  }

  /**
   * Get configuration
   * @returns {Object} - Configuration
   */
  getConfig() {
    return this.config.getConfig();
  }

  /**
   * Update statistics based on position history
   */
  updateStatistics() {
    // Calculate total P/L
    let totalPL = 0;
    let winCount = 0;
    let bestTrade = null;
    let bestProfit = -Infinity;
    
    this.closedPositions.forEach(position => {
      if (position.profits) {
        // Add to total P/L
        totalPL += position.profits.raw;
        
        // Check if it's a winning trade
        if (position.profits.percent > 0) {
          winCount++;
        }
        
        // Check if it's the best trade
        if (position.profits.percent > bestProfit) {
          bestProfit = position.profits.percent;
          bestTrade = {
            symbol: position.symbol,
            profit: position.profits.percent
          };
        }
      }
    });
    
    // Update statistics
    this.status.totalProfitLoss = totalPL;
    this.status.winRate = this.closedPositions.length > 0 
      ? (winCount / this.closedPositions.length) * 100 
      : 0;
    this.status.bestTrade = bestTrade;
    
    // Update account balance
    this.status.accountBalance = this.config.accountBalance + totalPL;
  }

  /**
   * Start uptime counter
   */
  startUptimeCounter() {
    this.status.uptime = 0;
    
    setInterval(() => {
      if (this.status.running) {
        this.status.uptime++;
      }
    }, 1000);
  }

  /**
   * Generate mock prices for testing
   * @param {number} count - Number of prices to generate
   * @returns {number[]} - Array of prices
   */
  generateMockPrices(count) {
    const prices = [];
    let price = 100 + Math.random() * 100; // Start with random price between 100-200
    
    for (let i = 0; i < count; i++) {
      // Random price change between -1% and +1%
      const change = price * (Math.random() * 0.02 - 0.01);
      price += change;
      prices.push(price);
    }
    
    return prices;
  }

  /**
   * Simple Moving Average calculation
   * @param {number[]} prices - Array of prices
   * @param {number} period - Period for MA calculation
   * @returns {number|null} - Moving average or null if not enough data
   */
  calcMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * RSI calculation
   * @param {number[]} prices - Array of prices
   * @param {number} period - Period for RSI calculation
   * @returns {number|null} - RSI value or null if not enough data
   */
  calcRSI(prices, period) {
    if (prices.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }

  /**
   * MACD calculation
   * @param {number[]} prices - Array of prices
   * @returns {Object|null} - MACD values or null if not enough data
   */
  calcMACD(prices) {
    if (prices.length < 26) return null;
    
    // Use the technical indicators library for the actual implementation
    const macd = {
      macdLine: 0,
      signalLine: 0,
      histogram: 0
    };
    
    return macd;
  }

  /**
   * Bollinger Bands calculation
   * @param {number[]} prices - Array of prices
   * @returns {Object|null} - Bollinger bands or null if not enough data
   */
  calcBollingerBands(prices) {
    if (prices.length < 20) return null;
    
    // Use the technical indicators library for the actual implementation
    const bands = {
      upper: 0,
      middle: 0,
      lower: 0
    };
    
    return bands;
  }

  /**
   * Stochastic Oscillator calculation
   * @param {number[]} prices - Array of prices
   * @returns {Object|null} - Stochastic values or null if not enough data
   */
  calcStochastic(prices) {
    if (prices.length < 14) return null;
    
    // Use the technical indicators library for the actual implementation
    const stoch = {
      percentK: 0,
      percentD: 0
    };
    
    return stoch;
  }
}

/**
 * Handle process shutdown
 * @param {TradingBot} bot - Trading bot instance
 */
async function handleShutdown(bot) {
  logger.info('[SHUTDOWN] Received shutdown signal');
  
  try {
    await bot.stop();
    logger.info('[SHUTDOWN] Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error(`[SHUTDOWN] Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const bot = new TradingBot();
  
  // Set up signal handlers for graceful shutdown
  process.on('SIGINT', () => handleShutdown(bot));
  process.on('SIGTERM', () => handleShutdown(bot));
  
  try {
    // Initialize the bot
    const initialized = await bot.initialize();
    if (!initialized) {
      logger.error('[MAIN] Failed to initialize trading bot');
      process.exit(1);
    }
    
    // Start the bot
    await bot.start();
    logger.info('[MAIN] MEXC Trading Bot started successfully');
  } catch (error) {
    logger.error(`[MAIN] Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  logger.error(`[MAIN] Unhandled error: ${error.message}`);
  process.exit(1);
});
