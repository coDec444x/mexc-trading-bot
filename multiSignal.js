const BaseStrategy = require('./baseStrategy');
const indicators = require('../indicators/technicals');

/**
 * MultiSignal Strategy
 * Implements a composite signal scoring system based on multiple technical indicators
 */
class MultiSignalStrategy extends BaseStrategy {
  /**
   * Constructor for the MultiSignal strategy
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    super(config);
    this.name = 'MultiSignalStrategy';
    this.description = 'Composite signal scoring using multiple technical indicators';
    this.minSignalScore = 3; // Minimum score to generate a buy signal
  }

  /**
   * Analyze market data and generate signals
   * @param {string} symbol - Trading pair symbol
   * @param {Object} marketData - Market data object containing prices and precomputed indicators
   * @returns {Object} - Signal object with buy/sell recommendations and score details
   */
  analyze(symbol, marketData) {
    // Default response with no signal
    const defaultResponse = {
      symbol,
      timestamp: new Date().toISOString(),
      signal: 'NEUTRAL',
      score: 0,
      details: {}
    };
    
    // Check if we have enough data
    if (!marketData || !marketData.prices || marketData.prices.length < 50) {
      return { ...defaultResponse, error: 'Insufficient data for analysis' };
    }
    
    const { prices, highPrices, lowPrices } = marketData;
    const currentPrice = prices[prices.length - 1];
    
    // Calculate indicators if not already provided
    const ma5 = marketData.ma5 || indicators.calcMA(prices, this.config.indicators.ma.shortPeriod);
    const ma20 = marketData.ma20 || indicators.calcMA(prices, this.config.indicators.ma.longPeriod);
    const rsi14 = marketData.rsi14 || indicators.calcRSI(prices, this.config.indicators.rsi.period);
    const macd = marketData.macd || indicators.calcMACD(
      prices, 
      this.config.indicators.macd.shortPeriod,
      this.config.indicators.macd.longPeriod,
      this.config.indicators.macd.signalPeriod
    );
    const bollinger = marketData.bollinger || indicators.calcBollingerBands(
      prices,
      this.config.indicators.bollinger.period,
      this.config.indicators.bollinger.stdDev
    );
    
    let stochastic = marketData.stochastic;
    if (!stochastic && highPrices && lowPrices) {
      stochastic = indicators.calcStochastic(prices, highPrices, lowPrices, 14);
    }
    
    const atr = marketData.atr || (highPrices && lowPrices ? 
      indicators.calcATR(prices, highPrices, lowPrices, this.config.indicators.atr.period) : 
      null);
    
    // Composite signal scoring
    let signalScore = 0;
    const details = {};
    
    // Moving Average crossover (MA5 > MA20)
    if (ma5 !== null && ma20 !== null) {
      const maSignal = ma5 > ma20;
      signalScore += maSignal ? 1 : 0;
      details.movingAverageCrossover = {
        signal: maSignal ? 'BULLISH' : 'BEARISH',
        values: { ma5, ma20 }
      };
    }
    
    // RSI oversold condition
    if (rsi14 !== null) {
      const rsiSignal = rsi14 < this.config.indicators.rsi.oversold;
      signalScore += rsiSignal ? 1 : 0;
      details.rsi = {
        signal: rsiSignal ? 'BULLISH' : 'NEUTRAL',
        values: { rsi14, threshold: this.config.indicators.rsi.oversold }
      };
    }
    
    // MACD crossover (MACD line > Signal line)
    if (macd && macd.macdLine !== null && macd.signalLine !== null) {
      const macdSignal = macd.macdLine > macd.signalLine;
      signalScore += macdSignal ? 1 : 0;
      details.macd = {
        signal: macdSignal ? 'BULLISH' : 'BEARISH',
        values: { macdLine: macd.macdLine, signalLine: macd.signalLine, histogram: macd.histogram }
      };
    }
    
    // Bollinger Bands (price below lower band)
    if (bollinger && bollinger.lower !== null) {
      const bollingerSignal = currentPrice < bollinger.lower;
      signalScore += bollingerSignal ? 1 : 0;
      details.bollinger = {
        signal: bollingerSignal ? 'BULLISH' : 'NEUTRAL',
        values: { upper: bollinger.upper, middle: bollinger.middle, lower: bollinger.lower }
      };
    }
    
    // Stochastic oversold condition
    if (stochastic && stochastic.percentK !== null) {
      const stochSignal = stochastic.percentK < 20;
      signalScore += stochSignal ? 1 : 0;
      details.stochastic = {
        signal: stochSignal ? 'BULLISH' : 'NEUTRAL',
        values: { percentK: stochastic.percentK, percentD: stochastic.percentD }
      };
    }
    
    // Determine the overall signal
    let signal = 'NEUTRAL';
    if (signalScore >= this.minSignalScore) {
      signal = 'BUY';
    }
    
    return {
      symbol,
      timestamp: new Date().toISOString(),
      signal,
      score: signalScore,
      details,
      indicators: {
        ma5, ma20, rsi14, macd, bollinger, stochastic, atr
      }
    };
  }
  
  /**
   * Calculate dynamic position size based on ATR volatility
   * @param {string} symbol - Trading pair symbol
   * @param {number} accountSize - Account size in USDT
   * @param {number} riskPercent - Risk percentage (0-1)
   * @param {Object} marketData - Market data for volatility assessment
   * @returns {number} - Position size in USDT
   */
  calculatePositionSize(symbol, accountSize, riskPercent, marketData) {
    // Start with the base position size (account * risk)
    let positionSize = accountSize * riskPercent;
    
    // Adjust based on ATR if available
    if (marketData && marketData.atr) {
      const atr = marketData.atr;
      // If ATR is higher than threshold, reduce position size
      if (atr > this.config.atrThreshold) {
        const volatilityFactor = this.config.atrThreshold / atr;
        positionSize *= Math.min(Math.max(volatilityFactor, 0.5), 1);
      }
    }
    
    return positionSize;
  }
  
  /**
   * Calculate dynamic stop loss based on ATR
   * @param {string} symbol - Trading pair symbol
   * @param {number} entryPrice - Entry price
   * @param {Object} marketData - Market data for dynamic calculations
   * @returns {number} - Stop loss price
   */
  calculateStopLoss(symbol, entryPrice, marketData) {
    // Default stop loss
    let stopLossPrice = entryPrice * (1 - this.config.stopLossPct);
    
    // If ATR is available, use it for a more dynamic stop loss
    if (marketData && marketData.atr) {
      const atrStopLoss = entryPrice - (marketData.atr * 1.5);
      // Use the tighter of the two stop losses
      stopLossPrice = Math.max(stopLossPrice, atrStopLoss);
    }
    
    return stopLossPrice;
  }
  
  /**
   * Calculate dynamic take profit based on ATR
   * @param {string} symbol - Trading pair symbol
   * @param {number} entryPrice - Entry price
   * @param {Object} marketData - Market data for dynamic calculations
   * @returns {number} - Take profit price
   */
  calculateTakeProfit(symbol, entryPrice, marketData) {
    // Default take profit
    let takeProfitPrice = entryPrice * (1 + this.config.takeProfitPct);
    
    // If ATR is available, use it for a more dynamic take profit
    if (marketData && marketData.atr) {
      const atrTakeProfit = entryPrice + (marketData.atr * 2.5);
      // Use the more aggressive of the two take profits
      takeProfitPrice = Math.min(takeProfitPrice, atrTakeProfit);
    }
    
    return takeProfitPrice;
  }
}

module.exports = MultiSignalStrategy;
