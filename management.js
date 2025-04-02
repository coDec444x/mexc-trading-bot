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
    new winston.transports.File({ filename: 'risk.log' })
  ]
});

/**
 * Position Management Class
 * Handles risk management for open trading positions
 */
class PositionManager {
  /**
   * Constructor for the Position Manager
   * @param {Object} config - Configuration object
   * @param {Object} mexcApi - The MEXC API client interface
   */
  constructor(config, mexcApi) {
    this.config = config;
    this.mexcApi = mexcApi;
    this.openPositions = {};
  }

  /**
   * Open a new position
   * @param {string} symbol - Trading pair symbol
   * @param {number} entryPrice - Entry price
   * @param {number} quantity - Position size in base asset
   * @param {Object} marketData - Market data for setting dynamic stops
   * @returns {Object} - Position object
   */
  openPosition(symbol, entryPrice, quantity, marketData) {
    const stopLossPrice = this._calculateStopLoss(entryPrice, marketData);
    const takeProfitPrice = this._calculateTakeProfit(entryPrice, marketData);
    
    const position = {
      symbol,
      entryPrice,
      quantity,
      stopLossPrice,
      takeProfitPrice,
      highestPrice: entryPrice, // For trailing stop
      trailingStopDistance: entryPrice * this.config.trailingStopPct,
      openTime: new Date().toISOString(),
      lastUpdateTime: new Date().toISOString(),
      profits: null,
      status: 'OPEN'
    };
    
    this.openPositions[symbol] = position;
    logger.info(`[POSITION OPENED] ${symbol}: Entry=${entryPrice}, Qty=${quantity}, SL=${stopLossPrice}, TP=${takeProfitPrice}`);
    
    return position;
  }

  /**
   * Close an existing position
   * @param {string} symbol - Trading pair symbol
   * @param {number} exitPrice - Exit price
   * @param {string} reason - Reason for closing the position
   * @returns {Object} - Closed position object with profit data
   */
  async closePosition(symbol, exitPrice, reason) {
    if (!this.openPositions[symbol]) {
      logger.warn(`[CLOSE POSITION] No open position found for ${symbol}`);
      return null;
    }
    
    const position = this.openPositions[symbol];
    const profitLoss = (exitPrice - position.entryPrice) * position.quantity;
    const profitLossPercent = ((exitPrice / position.entryPrice) - 1) * 100;
    
    position.exitPrice = exitPrice;
    position.closeTime = new Date().toISOString();
    position.profits = {
      raw: profitLoss,
      percent: profitLossPercent
    };
    position.closeReason = reason;
    position.status = 'CLOSED';
    
    // Execute sell order if not in dry run mode
    try {
      if (!this.config.dryRun) {
        await this.mexcApi.placeMarketSell(symbol, position.quantity);
      } else {
        logger.info(`[DRY RUN] Would close position for ${symbol}: Exit=${exitPrice}, P/L=${profitLossPercent.toFixed(2)}%`);
      }
      
      logger.info(`[POSITION CLOSED] ${symbol}: Exit=${exitPrice}, P/L=${profitLossPercent.toFixed(2)}%, Reason=${reason}`);
      
      // Store closed position for historical records and delete from open positions
      const closedPosition = { ...position };
      delete this.openPositions[symbol];
      
      return closedPosition;
    } catch (error) {
      logger.error(`[CLOSE POSITION ERROR] ${symbol}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update and check all open positions
   * @param {Object} marketData - Current market data by symbol
   * @returns {Array} - Array of actions taken
   */
  async updatePositions(marketData) {
    const actions = [];
    
    for (const symbol in this.openPositions) {
      if (!marketData[symbol] || !marketData[symbol].prices) {
        logger.warn(`[UPDATE POSITION] No market data available for ${symbol}`);
        continue;
      }
      
      const position = this.openPositions[symbol];
      const prices = marketData[symbol].prices;
      const currentPrice = prices[prices.length - 1];
      
      // Update highest price for trailing stop
      if (currentPrice > position.highestPrice) {
        position.highestPrice = currentPrice;
        position.lastUpdateTime = new Date().toISOString();
      }
      
      // Check stop loss
      if (currentPrice <= position.stopLossPrice) {
        logger.info(`[STOP LOSS] ${symbol} triggered at ${currentPrice}`);
        const closedPosition = await this.closePosition(symbol, currentPrice, 'STOP_LOSS');
        actions.push({ action: 'CLOSE', reason: 'STOP_LOSS', symbol, position: closedPosition });
        continue;
      }
      
      // Check take profit
      if (currentPrice >= position.takeProfitPrice) {
        logger.info(`[TAKE PROFIT] ${symbol} triggered at ${currentPrice}`);
        const closedPosition = await this.closePosition(symbol, currentPrice, 'TAKE_PROFIT');
        actions.push({ action: 'CLOSE', reason: 'TAKE_PROFIT', symbol, position: closedPosition });
        continue;
      }
      
      // Check trailing stop
      const trailingStopPrice = position.highestPrice * (1 - this.config.trailingStopPct);
      if (position.highestPrice > position.entryPrice && currentPrice < trailingStopPrice) {
        logger.info(`[TRAILING STOP] ${symbol} triggered at ${currentPrice}, dropped from high of ${position.highestPrice}`);
        const closedPosition = await this.closePosition(symbol, currentPrice, 'TRAILING_STOP');
        actions.push({ action: 'CLOSE', reason: 'TRAILING_STOP', symbol, position: closedPosition });
        continue;
      }
      
      // Update dynamic stop loss and take profit if market has moved significantly
      this._updateDynamicLevels(symbol, position, marketData[symbol]);
    }
    
    return actions;
  }

  /**
   * Get all currently open positions
   * @returns {Object} - Object containing all open positions
   */
  getOpenPositions() {
    return { ...this.openPositions };
  }

  /**
   * Check if a position is already open for a symbol
   * @param {string} symbol - Trading pair symbol
   * @returns {boolean} - True if position is open
   */
  hasOpenPosition(symbol) {
    return !!this.openPositions[symbol];
  }

  /**
   * Calculate stop loss level
   * @private
   * @param {number} entryPrice - Entry price
   * @param {Object} marketData - Market data for dynamic calculation
   * @returns {number} - Stop loss price
   */
  _calculateStopLoss(entryPrice, marketData) {
    // Default stop loss based on fixed percentage
    let stopLoss = entryPrice * (1 - this.config.stopLossPct);
    
    // Dynamic stop loss based on ATR if available
    if (marketData && marketData.atr) {
      const atrStopLoss = entryPrice - (marketData.atr * 1.5);
      // Use the higher of the two (tighter stop loss)
      stopLoss = Math.max(stopLoss, atrStopLoss);
    }
    
    return stopLoss;
  }

  /**
   * Calculate take profit level
   * @private
   * @param {number} entryPrice - Entry price
   * @param {Object} marketData - Market data for dynamic calculation
   * @returns {number} - Take profit price
   */
  _calculateTakeProfit(entryPrice, marketData) {
    // Default take profit based on fixed percentage
    let takeProfit = entryPrice * (1 + this.config.takeProfitPct);
    
    // Dynamic take profit based on ATR if available
    if (marketData && marketData.atr) {
      const atrTakeProfit = entryPrice + (marketData.atr * 2.5);
      // Use the lower of the two (more conservative)
      takeProfit = Math.min(takeProfit, atrTakeProfit);
    }
    
    return takeProfit;
  }

  /**
   * Update dynamic stop loss and take profit levels
   * @private
   * @param {string} symbol - Trading pair symbol
   * @param {Object} position - Position object
   * @param {Object} marketData - Current market data
   */
  _updateDynamicLevels(symbol, position, marketData) {
    // Only update if we have ATR and price has moved in our favor
    if (!marketData.atr || marketData.prices[marketData.prices.length - 1] <= position.entryPrice) {
      return;
    }
    
    // Calculate how far price has moved in our favor
    const priceMove = position.highestPrice - position.entryPrice;
    const moveFactor = priceMove / position.entryPrice;
    
    // Only update if price has moved significantly
    if (moveFactor > 0.02) { // 2% or more
      // Adjust stop loss to breakeven or better after significant move
      const newStopLoss = Math.max(
        position.stopLossPrice,
        position.entryPrice + (priceMove * 0.1) // Move stop loss to lock in 10% of gains
      );
      
      if (newStopLoss > position.stopLossPrice) {
        position.stopLossPrice = newStopLoss;
        logger.info(`[DYNAMIC SL] Updated stop loss for ${symbol} to ${newStopLoss}`);
      }
    }
  }
}

module.exports = PositionManager;
