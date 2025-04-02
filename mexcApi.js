require("dotenv").config();
const axios = require('axios');
const crypto = require('crypto');
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
    new winston.transports.File({ filename: 'bot.log' })
  ]
});

// Configure API settings
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const BASE_URL = process.env.BASE_URL || "https://api.mexc.com";

// Create axios instance
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-MEXC-APIKEY': API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Generate signature for authenticated requests
 * @param {Object} params - Request parameters
 * @returns {string} - HMAC SHA256 signature
 */
function generateSignature(params) {
  // Convert params to query string
  const queryString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  // Create HMAC SHA256 signature
  return crypto
    .createHmac('sha256', API_SECRET)
    .update(queryString)
    .digest('hex');
}

/**
 * Make a signed API request
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} - API response
 */
async function signedRequest(method, endpoint, params = {}) {
  // Add timestamp parameter
  const timestamp = Date.now();
  const queryParams = {
    ...params,
    timestamp
  };
  
  // Generate signature
  const signature = generateSignature(queryParams);
  
  // Add signature to params
  queryParams.signature = signature;
  
  // Build URL with query params
  const url = endpoint + '?' + Object.keys(queryParams)
    .map(key => `${key}=${queryParams[key]}`)
    .join('&');
  
  try {
    const response = await apiClient.request({
      method,
      url
    });
    
    return response.data;
  } catch (error) {
    logger.error(`API request error: ${error.message}`);
    throw error;
  }
}

/**
 * Execute a market buy order for a given symbol and USDT amount
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param {number} usdtAmount - Amount to spend in USDT
 * @returns {Promise<Object>} - Order response
 */
async function placeMarketBuy(symbol, usdtAmount) {
  try {
    // Check if in dry run mode
    if (process.env.DRY_RUN === 'true') {
      logger.info(`[DRY RUN] Would place market buy: ${symbol}, ${usdtAmount} USDT`);
      // Mock response for dry run
      return {
        symbol: symbol,
        orderId: 'dry-run-' + Date.now(),
        executedQty: (usdtAmount / 100).toFixed(8), // Mock quantity
        cummulativeQuoteQty: usdtAmount.toFixed(2),
        status: 'FILLED',
        type: 'MARKET',
        side: 'BUY',
        fills: [{ price: '100.00' }]
      };
    }

    // Construct order parameters
    const orderParams = {
      symbol: symbol,
      side: "BUY",
      type: "MARKET",
      quoteOrderQty: usdtAmount.toFixed(2)
    };
    
    logger.info(`Placing market buy order: ${symbol}, ${usdtAmount} USDT`);
    
    // Make API request to place order
    const response = await signedRequest('POST', '/api/v3/order', orderParams);
    logger.info(`[API BUY SUCCESS] ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    logger.error(`[API BUY ERROR] ${error.message}`);
    throw error;
  }
}

/**
 * Execute a market sell order for a given symbol and quantity
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT') 
 * @param {number} quantity - Amount of the base asset to sell
 * @returns {Promise<Object>} - Order response
 */
async function placeMarketSell(symbol, quantity) {
  try {
    // Check if in dry run mode
    if (process.env.DRY_RUN === 'true') {
      logger.info(`[DRY RUN] Would place market sell: ${symbol}, ${quantity} units`);
      // Mock response for dry run
      return {
        symbol: symbol,
        orderId: 'dry-run-' + Date.now(),
        executedQty: quantity.toString(),
        cummulativeQuoteQty: (quantity * 100).toFixed(2), // Mock USDT value
        status: 'FILLED',
        type: 'MARKET',
        side: 'SELL'
      };
    }

    // Construct order parameters
    const orderParams = {
      symbol: symbol,
      side: "SELL",
      type: "MARKET",
      quantity: quantity.toString()
    };
    
    logger.info(`Placing market sell order: ${symbol}, ${quantity} units`);
    
    // Make API request to place order
    const response = await signedRequest('POST', '/api/v3/order', orderParams);
    logger.info(`[API SELL SUCCESS] ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    logger.error(`[API SELL ERROR] ${error.message}`);
    throw error;
  }
}

/**
 * Get current account information
 * @returns {Promise<Object>} - Account information
 */
async function getAccountInfo() {
  try {
    if (process.env.DRY_RUN === 'true') {
      logger.info('[DRY RUN] Would get account info');
      return {
        balances: [
          { asset: 'USDT', free: process.env.ACCOUNT_BALANCE || '150.00', locked: '0.00' }
        ]
      };
    }
    
    const response = await signedRequest('GET', '/api/v3/account');
    return response;
  } catch (error) {
    logger.error(`[API ACCOUNT ERROR] ${error.message}`);
    throw error;
  }
}

/**
 * Get exchange information including symbol trading rules
 * @returns {Promise<Object>} - Exchange information
 */
async function getExchangeInfo() {
  try {
    const response = await apiClient.get('/api/v3/exchangeInfo');
    return response.data;
  } catch (error) {
    logger.error(`[API EXCHANGE INFO ERROR] ${error.message}`);
    throw error;
  }
}

module.exports = {
  placeMarketBuy,
  placeMarketSell,
  getAccountInfo,
  getExchangeInfo
};
