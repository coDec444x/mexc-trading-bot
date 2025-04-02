const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration manager for the trading bot
 */
class Config {
  constructor() {
    this.loadConfig();
  }

  /**
   * Load and validate configuration
   */
  loadConfig() {
    // API credentials
    this.apiKey = process.env.API_KEY;
    this.apiSecret = process.env.API_SECRET;
    this.baseUrl = process.env.BASE_URL || 'https://api.mexc.com';

    // Trading parameters
    this.dryRun = process.env.DRY_RUN === 'true';
    this.accountBalance = parseFloat(process.env.ACCOUNT_BALANCE || '150');
    this.riskPercent = parseFloat(process.env.RISK_PERCENT || '1') / 100;
    this.stopLossPct = parseFloat(process.env.STOP_LOSS_PCT || '2') / 100;
    this.takeProfitPct = parseFloat(process.env.TAKE_PROFIT_PCT || '5') / 100;
    this.trailingStopPct = parseFloat(process.env.TRAILING_STOP_PCT || '1') / 100;
    this.atrThreshold = parseFloat(process.env.ATR_THRESHOLD || '1.0');

    // Web server
    this.port = parseInt(process.env.PORT || '3000', 10);

    // Symbols to monitor and trade
    this.symbolList = [
      "C4EUSDT", "PONCHUSDT", "GLUTEUUSDT", "BLENDUSDT", "KCSUSDT",
      "WRLDUSDT", "BABYDOGE2USDT", "AGNTUSDT", "LOOPUSDT", "BURGERUSDT",
      "FILUSDT", "TRUMP1USDT", "ATTUSDT", "CELLUSDT", "SHIBAUSDT",
      "RAYUSDC", "GMEUSDT", "SEEDUSDT", "MEMESAIUSDT", "CATDOGUSDT",
      "FLOKIUSDT", "MATHUSDT", "MXUSDT", "ANVLUSDT", "BITCOINAIUSDT",
      "DRIFTUSDT", "MLUSDT", "NEIROETHUSDT", "BOOUSDT", "DMTRUSDT"
    ];

    // Indicators timeframes
    this.timeframes = {
      default: '1m',
      options: ['1m', '5m', '15m', '30m', '1h', '4h']
    };

    // Technical indicator settings
    this.indicators = {
      ma: {
        shortPeriod: 5,
        longPeriod: 20
      },
      rsi: {
        period: 14,
        overbought: 70,
        oversold: 30
      },
      macd: {
        shortPeriod: 12,
        longPeriod: 26,
        signalPeriod: 9
      },
      bollinger: {
        period: 20,
        stdDev: 2
      },
      atr: {
        period: 14
      }
    };

    this.validateConfig();
  }

  /**
   * Validate essential configuration settings
   */
  validateConfig() {
    const errors = [];

    // In dry run mode, we don't need API credentials
    if (!this.dryRun) {
      if (!this.apiKey) errors.push('API_KEY is required for live trading');
      if (!this.apiSecret) errors.push('API_SECRET is required for live trading');
    }

    if (this.accountBalance <= 0) errors.push('ACCOUNT_BALANCE must be greater than 0');
    if (this.riskPercent <= 0 || this.riskPercent > 0.1) {
      errors.push('RISK_PERCENT should be between 0.1 and 10 (%)');
    }

    if (errors.length > 0) {
      console.error('Configuration validation failed:');
      errors.forEach(err => console.error(`- ${err}`));
      
      if (!this.dryRun && (!this.apiKey || !this.apiSecret)) {
        console.log('Switching to dry run mode due to missing API credentials');
        this.dryRun = true;
      }
    }

    return errors.length === 0;
  }

  /**
   * Get the configuration as a plain object
   * @returns {Object} Configuration as a plain object
   */
  getConfig() {
    return {
      apiKey: this.apiKey ? '********' : undefined,
      apiSecret: this.apiSecret ? '********' : undefined, 
      baseUrl: this.baseUrl,
      dryRun: this.dryRun,
      accountBalance: this.accountBalance,
      riskPercent: this.riskPercent,
      stopLossPct: this.stopLossPct,
      takeProfitPct: this.takeProfitPct,
      trailingStopPct: this.trailingStopPct,
      atrThreshold: this.atrThreshold,
      port: this.port,
      symbolList: this.symbolList,
      timeframes: this.timeframes,
      indicators: this.indicators
    };
  }
}

// Create and export a singleton instance
const config = new Config();
module.exports = config;
