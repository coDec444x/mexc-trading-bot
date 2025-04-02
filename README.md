# MEXC Trading Bot

An automated cryptocurrency trading bot for the MEXC exchange.

## Overview

This trading bot uses technical analysis indicators and a scoring-based decision system to identify trading opportunities on the MEXC cryptocurrency exchange. The bot continuously monitors market data, executes trades based on configurable strategies, and provides a web dashboard for monitoring and control.

## Features

- **Multi-Indicator Strategy**: Uses a combination of technical indicators (MA, RSI, MACD, Bollinger Bands, Stochastic) for signal generation
- **Composite Scoring System**: Evaluates multiple indicators to generate stronger, more reliable trading signals
- **Risk Management**: Implements stop loss, take profit, and trailing stop mechanisms
- **Dynamic Position Sizing**: Adjusts position size based on market volatility
- **Web Dashboard**: Provides real-time monitoring and control through a browser interface
- **Dry Run Mode**: Test strategies without risking real funds
- **WebSocket Updates**: Receive real-time updates on market data and positions

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- MEXC Exchange API keys

### Steps

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/mexc-trading-bot.git
   cd mexc-trading-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your MEXC API keys and configuration:
   ```
   API_KEY=your_api_key_here
   API_SECRET=your_api_secret_here
   BASE_URL=https://api.mexc.com
   DRY_RUN=true
   ACCOUNT_BALANCE=150
   RISK_PERCENT=1
   STOP_LOSS_PCT=2
   TAKE_PROFIT_PCT=5
   TRAILING_STOP_PCT=1
   ATR_THRESHOLD=1.0
   PORT=3000
   ```

## Usage

1. Start the bot:
   ```
   npm start
   ```

2. Access the web dashboard:
   Open your browser and navigate to `http://localhost:3000`

3. Monitor trading activity and performance through the dashboard. You can:
   - View open positions and their status
   - See real-time market data and indicators
   - Force manual trades
   - Adjust settings
   - Pause/resume the bot

## Strategy

The bot uses a composite scoring system based on multiple technical indicators:

1. **Moving Average Crossover**: Bullish when 5-period MA crosses above 20-period MA
2. **RSI**: Bullish when RSI falls below 30 (oversold condition)
3. **MACD**: Bullish when MACD line crosses above signal line
4. **Bollinger Bands**: Bullish when price falls below lower band
5. **Stochastic Oscillator**: Bullish when %K line falls below 20

Each indicator contributes one point to the signal score when bullish. A score of 3 or higher triggers a buy signal.

## Risk Management

The bot implements several risk management features:

- **Stop Loss**: Automatically close positions at a specified loss percentage
- **Take Profit**: Automatically close positions at a specified profit percentage
- **Trailing Stop**: Lock in profits as the price moves in your favor
- **Dynamic Position Sizing**: Adjust position size based on market volatility
- **ATR-Based Adjustments**: Use Average True Range for dynamic stop loss and take profit levels

## Configuration

You can customize the bot's behavior by editing the .env file or through the web interface:

- Trading pairs to monitor
- Risk percentage per trade
- Stop loss and take profit levels
- Technical indicator parameters
- Dry run mode for testing

## Disclaimer

This software is for educational purposes only. Use at your own risk. Cryptocurrency trading involves significant risk and you could lose your investments. Always do your own research before trading.

## License

MIT License
