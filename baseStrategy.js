/**
 * Base Strategy Class
 * Provides a template for implementing trading strategies
 */
class BaseStrategy {
  /**
   * Constructor for the base strategy
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    this.config = config;
    this.name = 'BaseStrategy';
    this.description = 'Base strategy template';
  }

  /**
   * Initialize the strategy
   * @returns {boolean} - Success status
   */
  init() {
    // Base initialization code
    return true;
  }

  /**
   * Process market data and generate signals
   * @param {string} symbol - Trading pair symbol
   * @param {Object} marketData - Market data object containing indicators, prices, etc.
   * @returns {Object} - Signal object with buy/sell recommendations
   */
  analyze(symbol, marketData) {
    throw new Error('analyze() method must be implemented by derived strategy classes');
  }

  /**
   * Calculate position size based on risk parameters
   * @param {string} symbol - Trading pair symbol
   * @param {number} accountSize - Account size in USDT
   * @param {number} riskPercent - Risk percentage (0-1)
   * @param {Object} marketData - Market data for volatility assessment
   * @returns {number} - Position size in USDT
   */
  calculatePositionSize(symbol, accountSize, riskPercent, marketData) {
    // Default implementation (fixed percentage of account)
    return accountSize * riskPercent;
  }

  /**
   * Calculate stop loss price based on entry price and risk parameters
   * @param {string} symbol - Trading pair symbol
   * @param {number} entryPrice - Entry price
   * @param {Object} marketData - Market data for dynamic calculations
   * @returns {number} - Stop loss price
   */
  calculateStopLoss(symbol, entryPrice, marketData) {
    // Default implementation (fixed percentage below entry)
    return entryPrice * (1 - this.config.stopLossPct);
  }

  /**
   * Calculate take profit price based on entry price and risk parameters
   * @param {string} symbol - Trading pair symbol
   * @param {number} entryPrice - Entry price
   * @param {Object} marketData - Market data for dynamic calculations
   * @returns {number} - Take profit price
   */
  calculateTakeProfit(symbol, entryPrice, marketData) {
    // Default implementation (fixed percentage above entry)
    return entryPrice * (1 + this.config.takeProfitPct);
  }

  /**
   * Get information about the strategy
   * @returns {Object} - Strategy information
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      config: this.config
    };
  }
}

module.exports = BaseStrategy;
