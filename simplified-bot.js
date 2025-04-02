/**
 * Simplified MEXC Trading Bot
 * This version has no external dependencies for easy testing
 */

// Simple logging function
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`),
  warn: (message) => console.log(`[WARNING] ${new Date().toISOString()}: ${message}`),
  error: (message) => console.log(`[ERROR] ${new Date().toISOString()}: ${message}`),
  debug: (message) => console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`)
};

// Configuration (normally would be loaded from .env)
const config = {
  apiKey: 'mx0vgluzHUVwDXFZBX', // Would be loaded from environment in production
  apiSecret: 'f05ed3617ebf42d98ade54bceb839bd2', // Would be loaded from environment in production
  dryRun: true, // Always true for this simplified bot
  accountBalance: 150,
  riskPercent: 0.01, // 1%
  stopLossPct: 0.02, // 2%
  takeProfitPct: 0.05, // 5%
  trailingStopPct: 0.01, // 1%
  symbolList: [
    "BTCUSDT", "ETHUSDT", "XRPUSDT", "BNBUSDT", "ADAUSDT",
    "DOGEUSDT", "SOLUSDT", "MATICUSDT", "DOTUSDT", "LTCUSDT"
  ]
};

// Fetch real market data or generate mock data if needed
const fetchMarketData = async (symbol, count = 100) => {
  try {
    if (config.dryRun) {
      logger.info(`Using real API to fetch data for ${symbol} but in dry run mode (no actual trades)`);
      // Try to fetch real data from MEXC API
      const response = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=${count}`);
      
      if (response.ok) {
        const data = await response.json();
        // Extract close prices from klines [timestamp, open, high, low, close, volume, ...]
        return data.map(candle => parseFloat(candle[4]));
      } else {
        throw new Error(`API responded with status ${response.status}`);
      }
    }
  } catch (error) {
    logger.warn(`Failed to fetch real market data for ${symbol}: ${error.message}. Using mock data instead.`);
  }
  
  // Fallback to mock data if real API fails or if not in dry run mode
  logger.info(`Generating mock price data for ${symbol}`);
  const prices = [];
  let price = 100 + Math.random() * 100; // Start with random price between 100-200
  
  for (let i = 0; i < count; i++) {
    // Random price change between -1% and +1%
    const change = price * (Math.random() * 0.02 - 0.01);
    price += change;
    prices.push(price);
  }
  
  return prices;
};

// Technical indicators
const calcMA = (prices, period) => {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

const calcRSI = (prices, period = 14) => {
  if (prices.length < period + 1) return null;
  
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
};

// Simplified strategy
const analyzeMarket = (prices) => {
  // Calculate indicators
  const ma5 = calcMA(prices, 5);
  const ma20 = calcMA(prices, 20);
  const rsi = calcRSI(prices);
  const lastPrice = prices[prices.length - 1];
  
  // Generate signals (simplified)
  let signalScore = 0;
  
  // MA crossover (MA5 > MA20)
  if (ma5 > ma20) signalScore++;
  
  // RSI oversold condition
  if (rsi < 30) signalScore++;
  
  // Simple price momentum
  if (lastPrice > prices[prices.length - 5]) signalScore++;
  
  return {
    signal: signalScore >= 2 ? 'BUY' : 'NEUTRAL',
    score: signalScore,
    price: lastPrice,
    indicators: { ma5, ma20, rsi }
  };
};

// Risk management
const calculatePositionSize = (accountBalance, riskPercent) => {
  return accountBalance * riskPercent;
};

const calculateStopLoss = (entryPrice, stopLossPct) => {
  return entryPrice * (1 - stopLossPct);
};

const calculateTakeProfit = (entryPrice, takeProfitPct) => {
  return entryPrice * (1 + takeProfitPct);
};

// Mock trading
const executeTrade = (symbol, analysis) => {
  const positionSize = calculatePositionSize(config.accountBalance, config.riskPercent);
  const entryPrice = analysis.price;
  const stopLoss = calculateStopLoss(entryPrice, config.stopLossPct);
  const takeProfit = calculateTakeProfit(entryPrice, config.takeProfitPct);
  
  console.log(`
===== EXECUTING TRADE =====
Symbol: ${symbol}
Signal Strength: ${analysis.score}/3
Entry Price: $${entryPrice.toFixed(2)}
Position Size: $${positionSize.toFixed(2)} USDT
Stop Loss: $${stopLoss.toFixed(2)} (${(config.stopLossPct * 100).toFixed(1)}%)
Take Profit: $${takeProfit.toFixed(2)} (${(config.takeProfitPct * 100).toFixed(1)}%)
Technical Indicators:
  - MA5: ${analysis.indicators.ma5.toFixed(2)}
  - MA20: ${analysis.indicators.ma20.toFixed(2)}
  - RSI: ${analysis.indicators.rsi.toFixed(2)}
==========================
  `);
  
  return {
    symbol,
    entryPrice,
    positionSize,
    stopLoss,
    takeProfit,
    timestamp: new Date().toISOString()
  };
};

// Main bot logic
const runBot = async () => {
  console.log("Starting MEXC Trading Bot (Simplified Version)");
  console.log(`Mode: ${config.dryRun ? 'Dry Run (Simulation)' : 'Live Trading'}`);
  console.log(`Monitoring ${config.symbolList.length} symbols`);
  
  const positions = [];
  
  // Process each symbol
  for (const symbol of config.symbolList) {
    console.log(`\nAnalyzing ${symbol}...`);
    
    try {
      // Fetch real or mock price data
      const prices = await fetchMarketData(symbol, 100);
      
      // Analyze the market
      const analysis = analyzeMarket(prices);
      
      // Print analysis
      console.log(`Analysis for ${symbol}:`);
      console.log(`- Current Price: $${analysis.price.toFixed(2)}`);
      console.log(`- Signal: ${analysis.signal} (Score: ${analysis.score}/3)`);
      console.log(`- MA5: ${analysis.indicators.ma5.toFixed(2)}`);
      console.log(`- MA20: ${analysis.indicators.ma20.toFixed(2)}`);
      console.log(`- RSI: ${analysis.indicators.rsi.toFixed(2)}`);
      
      // Execute trade if we have a buy signal
      if (analysis.signal === 'BUY') {
        const position = executeTrade(symbol, analysis);
        positions.push(position);
      }
    } catch (error) {
      logger.error(`Error processing ${symbol}: ${error.message}`);
    }
  }
  
  // Summary
  console.log("\n===== SUMMARY =====");
  console.log(`Total symbols analyzed: ${config.symbolList.length}`);
  console.log(`Positions opened: ${positions.length}`);
  console.log("====================");
  
  if (positions.length > 0) {
    console.log("\nOpen Positions:");
    positions.forEach((pos, index) => {
      console.log(`${index + 1}. ${pos.symbol} - Entry: $${pos.entryPrice.toFixed(2)}, Size: $${pos.positionSize.toFixed(2)} USDT`);
    });
  }
};

// Run the bot
runBot();
