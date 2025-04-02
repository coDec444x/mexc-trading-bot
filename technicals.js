/**
 * Technical indicators module
 * Provides implementations of various technical analysis indicators
 */

/**
 * Calculate Simple Moving Average
 * @param {number[]} prices - Array of price data
 * @param {number} period - Period for MA calculation
 * @returns {number|null} - The calculated MA or null if not enough data
 */
function calcMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calculate Exponential Moving Average
 * @param {number[]} prices - Array of price data
 * @param {number} period - Period for EMA calculation
 * @returns {number|null} - The calculated EMA or null if not enough data
 */
function calcEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = calcMA(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Calculate Relative Strength Index
 * @param {number[]} prices - Array of price data
 * @param {number} period - Period for RSI calculation
 * @returns {number|null} - The calculated RSI or null if not enough data
 */
function calcRSI(prices, period = 14) {
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
 * Calculate Moving Average Convergence Divergence
 * @param {number[]} prices - Array of price data
 * @param {number} fastPeriod - Short period for MACD calculation
 * @param {number} slowPeriod - Long period for MACD calculation
 * @param {number} signalPeriod - Signal line period
 * @returns {Object|null} - The calculated MACD or null if not enough data
 */
function calcMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod) return null;
  
  let macdArray = [];
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    const subset = prices.slice(0, i + 1);
    const fastEMA = calcEMA(subset, fastPeriod);
    const slowEMA = calcEMA(subset, slowPeriod);
    if (fastEMA !== null && slowEMA !== null) {
      macdArray.push(fastEMA - slowEMA);
    }
  }
  
  if (macdArray.length < signalPeriod) return { macdLine: null, signalLine: null, histogram: null };
  
  const macdLine = macdArray[macdArray.length - 1];
  const signalLine = calcEMA(macdArray, signalPeriod);
  const histogram = macdLine - signalLine;
  
  return { macdLine, signalLine, histogram };
}

/**
 * Calculate Bollinger Bands
 * @param {number[]} prices - Array of price data
 * @param {number} period - Period for Bollinger Bands calculation
 * @param {number} multiplier - Standard deviation multiplier
 * @returns {Object|null} - The calculated Bollinger Bands or null if not enough data
 */
function calcBollingerBands(prices, period = 20, multiplier = 2) {
  if (prices.length < period) return null;
  
  const slice = prices.slice(-period);
  const ma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((acc, price) => acc + Math.pow(price - ma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    middle: ma,
    upper: ma + multiplier * std,
    lower: ma - multiplier * std,
    bandwidth: (2 * multiplier * std) / ma
  };
}

/**
 * Calculate Stochastic Oscillator
 * @param {number[]} prices - Array of closing prices
 * @param {number[]} highPrices - Array of high prices
 * @param {number[]} lowPrices - Array of low prices
 * @param {number} period - Lookback period
 * @param {number} smoothK - %K smoothing period
 * @param {number} smoothD - %D smoothing period
 * @returns {Object|null} - The calculated Stochastic or null if not enough data
 */
function calcStochastic(prices, highPrices, lowPrices, period = 14, smoothK = 3, smoothD = 3) {
  if (prices.length < period || highPrices.length < period || lowPrices.length < period) {
    return null;
  }
  
  // If only closing prices are provided, use them for high/low as fallback
  const highs = highPrices || prices;
  const lows = lowPrices || prices;
  
  // Calculate raw %K values
  let rawK = [];
  for (let i = period - 1; i < prices.length; i++) {
    const highSlice = highs.slice(i - period + 1, i + 1);
    const lowSlice = lows.slice(i - period + 1, i + 1);
    const currentClose = prices[i];
    
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    
    if (highestHigh === lowestLow) {
      rawK.push(100); // Avoid division by zero
    } else {
      const percentK = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      rawK.push(percentK);
    }
  }
  
  // Apply smoothing to %K if specified
  const smoothedK = smoothK > 1 ? calcSMA(rawK, smoothK) : rawK[rawK.length - 1];
  
  // Calculate %D as SMA of %K
  const kValues = Array.isArray(smoothedK) ? smoothedK : [smoothedK];
  const percentD = kValues.length >= smoothD ? calcSMA(kValues, smoothD) : null;
  
  return {
    percentK: Array.isArray(smoothedK) ? smoothedK[smoothedK.length - 1] : smoothedK,
    percentD: Array.isArray(percentD) ? percentD[percentD.length - 1] : percentD
  };
}

/**
 * Calculate Simple Moving Average for array data
 * Helper function for indicators like Stochastic
 * @param {number[]} data - Array of values
 * @param {number} period - Period for SMA
 * @returns {number[]|number} - The calculated SMA array or single value
 */
function calcSMA(data, period) {
  if (data.length < period) return null;
  
  if (data.length === period) {
    return data.reduce((a, b) => a + b, 0) / period;
  }
  
  let results = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    results.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  
  return results;
}

/**
 * Calculate Average True Range
 * @param {number[]} closePrices - Array of closing prices
 * @param {number[]} highPrices - Array of high prices
 * @param {number[]} lowPrices - Array of low prices
 * @param {number} period - Period for ATR calculation
 * @returns {number|null} - The calculated ATR or null if not enough data
 */
function calcATR(closePrices, highPrices, lowPrices, period = 14) {
  if (closePrices.length < period + 1 || 
      highPrices.length < period + 1 || 
      lowPrices.length < period + 1) {
    return null;
  }
  
  // Calculate True Range series
  let trValues = [];
  for (let i = 1; i < closePrices.length; i++) {
    const previousClose = closePrices[i - 1];
    const currentHigh = highPrices[i];
    const currentLow = lowPrices[i];
    
    const tr1 = Math.abs(currentHigh - currentLow);
    const tr2 = Math.abs(currentHigh - previousClose);
    const tr3 = Math.abs(previousClose - currentLow);
    
    trValues.push(Math.max(tr1, tr2, tr3));
  }
  
  // If we only have closing prices, use an approximate method
  if (highPrices === closePrices && lowPrices === closePrices) {
    trValues = [];
    for (let i = 1; i < closePrices.length; i++) {
      trValues.push(Math.abs(closePrices[i] - closePrices[i - 1]));
    }
  }
  
  // Calculate ATR as average of true ranges over period
  const relevantTR = trValues.slice(-period);
  return relevantTR.reduce((a, b) => a + b, 0) / period;
}

module.exports = {
  calcMA,
  calcEMA,
  calcRSI,
  calcMACD,
  calcBollingerBands,
  calcStochastic,
  calcATR
};
