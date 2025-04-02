/**
 * MEXC Trading Bot Dashboard
 * Frontend JavaScript for interacting with the trading bot API
 */

document.addEventListener('DOMContentLoaded', function() {
  // Socket.io instance for real-time updates
  const socket = io();
  
  // Chart.js instance for market visualization
  let marketChart = null;
  
  // Store for current data
  const state = {
    status: {
      running: true,
      dryRun: true,
      uptime: 0,
      startTime: null
    },
    positions: {},
    marketData: {},
    signals: {},
    config: null
  };
  
  // DOM elements
  const elements = {
    statusBadge: document.getElementById('bot-status'),
    accountBalance: document.getElementById('account-balance'),
    dryRunTag: document.getElementById('dry-run-tag'),
    openPositionsCount: document.getElementById('open-positions-count'),
    totalTrades: document.getElementById('total-trades'),
    winRate: document.getElementById('win-rate'),
    uptime: document.getElementById('uptime'),
    totalPL: document.getElementById('total-pl'),
    bestTrade: document.getElementById('best-trade'),
    activePairs: document.getElementById('active-pairs'),
    riskLevel: document.getElementById('risk-level'),
    positionsTable: document.getElementById('positions-tbody'),
    signalsTable: document.getElementById('signals-tbody'),
    pauseResumeBtn: document.getElementById('pause-resume-btn'),
    forceTradeBtn: document.getElementById('force-trade-btn'),
    refreshDataBtn: document.getElementById('refresh-data-btn'),
    marketChart: document.getElementById('market-chart')
  };
  
  // Initialize the dashboard
  function init() {
    // Set up event listeners
    setupEventListeners();
    
    // Initialize tooltips and popovers
    initBootstrapComponents();
    
    // Initialize the market chart
    initMarketChart();
    
    // Fetch initial data
    fetchInitialData();
    
    // Listen for real-time updates
    setupSocketListeners();
  }
  
  // Initialize Bootstrap components
  function initBootstrapComponents() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl);
    });
  }
  
  // Set up event listeners for UI interactions
  function setupEventListeners() {
    // Pause/Resume button
    elements.pauseResumeBtn.addEventListener('click', toggleBotStatus);
    
    // Force Trade button
    elements.forceTradeBtn.addEventListener('click', showForceTradeModal);
    
    // Refresh Data button
    elements.refreshDataBtn.addEventListener('click', refreshAllData);
    
    // Settings link
    document.querySelector('a[href="#settings"]').addEventListener('click', showSettingsModal);
    
    // Force trade modal
    document.getElementById('specific-symbol-check').addEventListener('change', toggleSymbolSelector);
    document.getElementById('confirm-force-trade').addEventListener('click', executeForcedTrade);
    
    // Settings modal
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    
    // Chart period buttons
    const chartPeriodButtons = document.querySelectorAll('[data-chart-period]');
    chartPeriodButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        chartPeriodButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        updateMarketChart(e.target.getAttribute('data-chart-period'));
      });
    });
  }
  
  // Set up Socket.IO listeners for real-time updates
  function setupSocketListeners() {
    // Initial data load
    socket.on('initial_data', (data) => {
      if (data.status) updateStatusInfo(data.status);
      if (data.positions) updatePositionsTable(data.positions);
    });
    
    // Market data updates
    socket.on('market_update', (data) => {
      state.marketData[data.symbol] = data.data;
      updateMarketInfo();
      updateSignalsTable();
    });
    
    // Position updates
    socket.on('position_update', (data) => {
      if (data.action === 'OPEN') {
        state.positions[data.position.symbol] = data.position;
      } else if (data.action === 'CLOSE') {
        delete state.positions[data.position.symbol];
      } else if (data.action === 'UPDATE') {
        state.positions[data.position.symbol] = data.position;
      }
      updatePositionsTable(state.positions);
    });
    
    // Bot status updates
    socket.on('status_update', (data) => {
      updateStatusInfo(data);
    });
    
    // Error handling
    socket.on('error', (error) => {
      showAlert('danger', 'Error', error.message);
    });
    
    // Connection status
    socket.on('connect', () => {
      showAlert('success', 'Connected', 'Real-time connection established');
    });
    
    socket.on('disconnect', () => {
      showAlert('warning', 'Disconnected', 'Real-time connection lost. Reconnecting...');
      elements.statusBadge.textContent = 'Disconnected';
      elements.statusBadge.classList.remove('bg-success', 'bg-warning');
      elements.statusBadge.classList.add('bg-danger');
    });
  }
  
  // Initialize the market chart
  function initMarketChart() {
    const ctx = elements.marketChart.getContext('2d');
    
    marketChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Price (USDT)'
            }
          }
        }
      }
    });
  }
  
  // Update the market chart with new data
  function updateMarketChart(period = '1h') {
    const symbols = Object.keys(state.positions);
    
    if (symbols.length === 0) {
      // Add some default symbols if no positions
      symbols.push(...Object.keys(state.marketData).slice(0, 5));
    }
    
    if (symbols.length === 0) {
      marketChart.data.labels = [];
      marketChart.data.datasets = [];
      marketChart.update();
      return;
    }
    
    // Fetch price data for the selected period
    fetchChartData(symbols, period)
      .then(data => {
        // Process data for Chart.js
        const datasets = [];
        const timeLabels = data.timestamps || [];
        
        symbols.forEach(symbol => {
          if (data[symbol]) {
            const color = getRandomColor();
            datasets.push({
              label: symbol,
              data: data[symbol],
              borderColor: color,
              backgroundColor: color + '20',
              tension: 0.1
            });
          }
        });
        
        marketChart.data.labels = timeLabels;
        marketChart.data.datasets = datasets;
        marketChart.update();
      })
      .catch(error => {
        console.error('Error updating chart:', error);
        showAlert('danger', 'Chart Error', 'Failed to update market chart data');
      });
  }
  
  // Fetch chart data for the selected symbols and period
  function fetchChartData(symbols, period) {
    return new Promise((resolve, reject) => {
      // For now, generate mock data until API is implemented
      const mockData = {
        timestamps: []
      };
      
      // Generate 24 time points for the last 24 hours/days based on period
      const now = new Date();
      let interval;
      
      switch(period) {
        case '1h':
          interval = 2.5 * 60 * 1000; // 2.5 minutes
          break;
        case '4h':
          interval = 10 * 60 * 1000; // 10 minutes
          break;
        case '1d':
          interval = 1 * 60 * 60 * 1000; // 1 hour
          break;
        default:
          interval = 2.5 * 60 * 1000; // 2.5 minutes
      }
      
      for (let i = 24; i >= 0; i--) {
        const timePoint = new Date(now.getTime() - (i * interval));
        mockData.timestamps.push(timePoint.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      
      // Generate price data for each symbol
      symbols.forEach(symbol => {
        const basePrice = Math.random() * 100 + 50; // Random base price between 50-150
        mockData[symbol] = [];
        
        for (let i = 0; i <= 24; i++) {
          // Create some random price movements
          const priceChange = (Math.random() - 0.5) * 5;
          const price = basePrice + priceChange;
          mockData[symbol].push(price.toFixed(2));
        }
      });
      
      resolve(mockData);
      
      // Once API is implemented:
      // fetch(`/api/chart-data?symbols=${symbols.join(',')}&period=${period}`)
      //   .then(response => response.json())
      //   .then(data => resolve(data))
      //   .catch(error => reject(error));
    });
  }
  
  // Fetch all initial data from the API
  function fetchInitialData() {
    Promise.all([
      fetch('/api/status').then(res => res.json()),
      fetch('/api/positions').then(res => res.json()),
      fetch('/api/market').then(res => res.json()),
      fetch('/api/config').then(res => res.json())
    ])
    .then(([statusData, positionsData, marketData, configData]) => {
      // Update state
      updateStatusInfo(statusData);
      updatePositionsTable(positionsData.positions);
      state.marketData = marketData.data || {};
      state.config = configData.config;
      
      // Update UI components
      updateMarketInfo();
      updateSignalsTable();
      populateSettingsForm();
      updateMarketChart();
    })
    .catch(error => {
      console.error('Failed to fetch initial data:', error);
      showAlert('danger', 'Connection Error', 'Failed to connect to the trading bot API');
    });
  }
  
  // Update status information display
  function updateStatusInfo(statusData) {
    if (!statusData) return;
    
    state.status = statusData;
    
    // Update status badge
    elements.statusBadge.textContent = statusData.running ? 'Running' : 'Paused';
    elements.statusBadge.classList.remove('bg-success', 'bg-warning', 'bg-danger');
    elements.statusBadge.classList.add(statusData.running ? 'bg-success' : 'bg-warning');
    
    // Update pause/resume button
    elements.pauseResumeBtn.innerHTML = statusData.running ? 
      '<i class="bi bi-pause-fill"></i> Pause' : 
      '<i class="bi bi-play-fill"></i> Resume';
    elements.pauseResumeBtn.classList.remove('btn-warning', 'btn-success');
    elements.pauseResumeBtn.classList.add(statusData.running ? 'btn-warning' : 'btn-success');
    
    // Update dry run tag
    elements.dryRunTag.style.display = statusData.dryRun ? 'block' : 'none';
    
    // Update account balance
    if (statusData.accountBalance) {
      elements.accountBalance.textContent = `$${statusData.accountBalance.toFixed(2)}`;
    }
    
    // Update statistics
    if (statusData.totalTrades !== undefined) {
      elements.totalTrades.textContent = statusData.totalTrades;
    }
    
    if (statusData.winRate !== undefined) {
      elements.winRate.textContent = `${statusData.winRate.toFixed(1)}%`;
    }
    
    // Update uptime
    if (statusData.uptime !== undefined) {
      state.status.uptime = statusData.uptime;
      updateUptime();
    }
    
    // Update other status displays
    if (statusData.totalProfitLoss !== undefined) {
      elements.totalPL.textContent = `$${statusData.totalProfitLoss.toFixed(2)}`;
      elements.totalPL.classList.remove('profit-positive', 'profit-negative');
      elements.totalPL.classList.add(statusData.totalProfitLoss >= 0 ? 'profit-positive' : 'profit-negative');
    }
    
    if (statusData.bestTrade) {
      elements.bestTrade.textContent = `${statusData.bestTrade.symbol}: ${statusData.bestTrade.profit.toFixed(2)}%`;
    }
    
    if (statusData.activePairsCount !== undefined && statusData.totalPairsCount !== undefined) {
      elements.activePairs.textContent = `${statusData.activePairsCount}/${statusData.totalPairsCount}`;
    }
    
    // Calculate risk level based on open positions and settings
    const openPositionsCount = Object.keys(state.positions).length;
    elements.openPositionsCount.textContent = openPositionsCount;
    
    let riskLevel = 'Low';
    let riskClass = 'text-success';
    
    if (openPositionsCount > 5) {
      riskLevel = 'High';
      riskClass = 'text-danger';
    } else if (openPositionsCount > 2) {
      riskLevel = 'Medium';
      riskClass = 'text-warning';
    }
    
    elements.riskLevel.textContent = riskLevel;
    elements.riskLevel.className = 'h5 mb-0 font-weight-bold ' + riskClass;
  }
  
  // Update positions table
  function updatePositionsTable(positions) {
    state.positions = positions || {};
    
    // Update positions count
    elements.openPositionsCount.textContent = Object.keys(state.positions).length;
    
    // Clear table
    elements.positionsTable.innerHTML = '';
    
    // If no positions, show message
    if (Object.keys(state.positions).length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="9" class="text-center">No open positions</td>';
      elements.positionsTable.appendChild(row);
      return;
    }
    
    // Add each position to the table
    for (const symbol in state.positions) {
      const position = state.positions[symbol];
      
      // Get current price from market data
      const currentPrice = state.marketData[symbol]?.prices?.slice(-1)[0] || position.entryPrice;
      
      // Calculate profit/loss
      const profitLoss = (currentPrice - position.entryPrice) * position.quantity;
      const profitLossPercent = ((currentPrice / position.entryPrice) - 1) * 100;
      
      // Create row
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${symbol}</td>
        <td>${position.entryPrice.toFixed(4)}</td>
        <td>${currentPrice.toFixed(4)}</td>
        <td>${position.quantity}</td>
        <td class="${profitLoss >= 0 ? 'profit-positive' : 'profit-negative'}">${profitLoss.toFixed(2)} USDT</td>
        <td class="${profitLoss >= 0 ? 'profit-positive' : 'profit-negative'}">${profitLossPercent.toFixed(2)}%</td>
        <td>${position.stopLossPrice.toFixed(4)}</td>
        <td>${position.takeProfitPrice.toFixed(4)}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-danger close-position-btn" data-symbol="${symbol}">
            Close
          </button>
        </td>
      `;
      
      // Add to table
      elements.positionsTable.appendChild(row);
    }
    
    // Add event listeners to close buttons
    document.querySelectorAll('.close-position-btn').forEach(button => {
      button.addEventListener('click', () => {
        const symbol = button.getAttribute('data-symbol');
        closePosition(symbol);
      });
    });
  }
  
  // Update market information
  function updateMarketInfo() {
    // This function will be implemented to update market overview sections
    // For now, we'll just update the market chart
    updateMarketChart();
  }
  
  // Update signals table
  function updateSignalsTable() {
    // Clear table
    elements.signalsTable.innerHTML = '';
    
    // Calculate signals for each symbol
    const signals = [];
    
    for (const symbol in state.marketData) {
      const data = state.marketData[symbol];
      
      // Skip if insufficient data
      if (!data || !data.prices || !data.indicators) continue;
      
      // Calculate signal score (simplified for now)
      let score = 0;
      const details = {};
      
      // MA crossover
      const ma5 = data.indicators.ma5;
      const ma20 = data.indicators.ma20;
      if (ma5 && ma20) {
        const maSignal = ma5 > ma20;
        score += maSignal ? 1 : 0;
        details.ma = {
          signal: maSignal ? 'BULLISH' : 'BEARISH',
          values: { ma5, ma20 }
        };
      }
      
      // RSI
      const rsi = data.indicators.rsi14;
      if (rsi !== undefined) {
        const rsiSignal = rsi < 30;
        score += rsiSignal ? 1 : 0;
        details.rsi = {
          signal: rsiSignal ? 'BULLISH' : 'NEUTRAL',
          value: rsi
        };
      }
      
      // MACD
      const macd = data.indicators.macd;
      if (macd && macd.macdLine !== undefined && macd.signalLine !== undefined) {
        const macdSignal = macd.macdLine > macd.signalLine;
        score += macdSignal ? 1 : 0;
        details.macd = {
          signal: macdSignal ? 'BULLISH' : 'BEARISH',
          values: macd
        };
      }
      
      // Bollinger Bands
      const bb = data.indicators.bollinger;
      if (bb && bb.lower !== undefined) {
        const price = data.prices[data.prices.length - 1];
        const bbSignal = price < bb.lower;
        score += bbSignal ? 1 : 0;
        details.bollinger = {
          signal: bbSignal ? 'BULLISH' : 'NEUTRAL',
          values: bb
        };
      }
      
      // Stochastic
      const stoch = data.indicators.stochastic;
      if (stoch && stoch.percentK !== undefined) {
        const stochSignal = stoch.percentK < 20;
        score += stochSignal ? 1 : 0;
        details.stochastic = {
          signal: stochSignal ? 'BULLISH' : 'NEUTRAL',
          values: stoch
        };
      }
      
      // Only include signals with score of at least 2
      if (score >= 2) {
        signals.push({
          symbol,
          score,
          signal: score >= 3 ? 'BUY' : 'NEUTRAL',
          details
        });
      }
    }
    
    // Sort by score (descending)
    signals.sort((a, b) => b.score - a.score);
    
    // If no signals, show message
    if (signals.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="9" class="text-center">No strong trading signals detected</td>';
      elements.signalsTable.appendChild(row);
      return;
    }
    
    // Add top 10 signals to the table
    signals.slice(0, 10).forEach(signal => {
      const row = document.createElement('tr');
      
      // Signal style
      const signalClass = signal.signal === 'BUY' ? 'signal-buy' : 
        (signal.signal === 'SELL' ? 'signal-sell' : 'signal-neutral');
      
      // Indicator styles
      const maClass = signal.details.ma?.signal === 'BULLISH' ? 'indicator-bullish' : 'indicator-bearish';
      const rsiClass = signal.details.rsi?.signal === 'BULLISH' ? 'indicator-bullish' : 'indicator-neutral';
      const macdClass = signal.details.macd?.signal === 'BULLISH' ? 'indicator-bullish' : 'indicator-bearish';
      const bbClass = signal.details.bollinger?.signal === 'BULLISH' ? 'indicator-bullish' : 'indicator-neutral';
      const stochClass = signal.details.stochastic?.signal === 'BULLISH' ? 'indicator-bullish' : 'indicator-neutral';
      
      row.innerHTML = `
        <td>${signal.symbol}</td>
        <td class="${signalClass}">${signal.signal}</td>
        <td>${signal.score}/5</td>
        <td class="${maClass}">${signal.details.ma ? signal.details.ma.signal : 'N/A'}</td>
        <td class="${rsiClass}">${signal.details.rsi ? Math.round(signal.details.rsi.value) : 'N/A'}</td>
        <td class="${macdClass}">${signal.details.macd ? signal.details.macd.signal : 'N/A'}</td>
        <td class="${bbClass}">${signal.details.bollinger ? signal.details.bollinger.signal : 'N/A'}</td>
        <td class="${stochClass}">${signal.details.stochastic ? Math.round(signal.details.stochastic.values.percentK) : 'N/A'}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-primary trade-symbol-btn" data-symbol="${signal.symbol}">
            Trade
          </button>
        </td>
      `;
      
      elements.signalsTable.appendChild(row);
    });
    
    // Add event listeners to trade buttons
    document.querySelectorAll('.trade-symbol-btn').forEach(button => {
      button.addEventListener('click', () => {
        const symbol = button.getAttribute('data-symbol');
        showForceTradeModal(symbol);
      });
    });
  }
  
  // Update uptime display
  function updateUptime() {
    const uptime = state.status.uptime || 0;
    
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    elements.uptime.textContent = `${hours}h ${minutes}m ${seconds}s`;
    
    // Update uptime every second
    setTimeout(updateUptime, 1000);
  }
  
  // Toggle bot status (pause/resume)
  function toggleBotStatus() {
    const action = state.status.running ? 'pause' : 'resume';
    
    fetch('/api/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        state.status.running = action === 'resume';
        updateStatusInfo(state.status);
        showAlert('success', 'Success', `Bot ${action === 'pause' ? 'paused' : 'resumed'} successfully`);
      } else {
        showAlert('danger', 'Error', data.error || `Failed to ${action} bot`);
      }
    })
    .catch(error => {
      console.error(`Error ${action}ing bot:`, error);
      showAlert('danger', 'Error', `Failed to ${action} bot`);
    });
  }
  
  // Show force trade modal
  function showForceTradeModal(symbol = null) {
    // Reset form
    document.getElementById('specific-symbol-check').checked = !!symbol;
    document.getElementById('symbol-select-container').style.display = symbol ? 'block' : 'none';
    
    // Populate symbol dropdown
    const symbolSelect = document.getElementById('symbol-select');
    symbolSelect.innerHTML = '';
    
    // Add symbols from config instead of market data
    // This ensures all configured symbols are available even if market data hasn't loaded
    let availableSymbols = [];
    
    // Check if we have the config with symbol list
    if (state.config && state.config.symbolList && Array.isArray(state.config.symbolList)) {
      availableSymbols = state.config.symbolList;
    } else {
      // Fallback to market data if config isn't available
      availableSymbols = Object.keys(state.marketData);
    }
    
    // Sort the symbols alphabetically
    availableSymbols.sort().forEach(sym => {
      // Skip if we already have an open position for this symbol
      const hasOpenPosition = !!state.positions[sym];
      
      const option = document.createElement('option');
      option.value = sym;
      
      // Show if there's an open position to avoid confusion
      option.textContent = sym + (hasOpenPosition ? ' (position open)' : '');
      
      // Disable options for symbols that already have open positions
      if (hasOpenPosition) {
        option.disabled = true;
      }
      
      if (sym === symbol) option.selected = true;
      symbolSelect.appendChild(option);
    });
    
    // Update the modal text to be clearer about forcing trades
    const modalTitle = document.getElementById('force-trade-modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Force Trade (Market Conditions Bypassed)';
    }
    
    // Update description text to be clearer
    const modalDescription = document.getElementById('force-trade-description');
    if (modalDescription) {
      modalDescription.innerHTML = '<strong>WARNING:</strong> This will execute a trade immediately regardless of market conditions or signals!';
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('force-trade-modal'));
    modal.show();
  }
  
  // Toggle symbol selector in force trade modal
  function toggleSymbolSelector() {
    const checked = document.getElementById('specific-symbol-check').checked;
    document.getElementById('symbol-select-container').style.display = checked ? 'block' : 'none';
    
    // Update the description text based on the selection
    const modalDescription = document.getElementById('force-trade-description');
    if (modalDescription) {
      if (checked) {
        modalDescription.innerHTML = '<strong>WARNING:</strong> This will execute a trade for the selected symbol immediately, regardless of market conditions or signals!';
      } else {
        modalDescription.innerHTML = '<strong>WARNING:</strong> This will execute a trade for a randomly selected symbol, regardless of market conditions or signals!';
      }
    }
  }
  
  // Execute forced trade
  function executeForcedTrade() {
    const useSpecificSymbol = document.getElementById('specific-symbol-check').checked;
    const symbol = useSpecificSymbol ? document.getElementById('symbol-select').value : null;
    
    // Show confirmation based on the selection
    let confirmMessage;
    if (useSpecificSymbol) {
      confirmMessage = `Are you sure you want to force a trade for ${symbol}? This will execute regardless of market conditions.`;
    } else {
      confirmMessage = 'Are you sure you want to force a trade for a randomly selected symbol? This will execute regardless of market conditions.';
    }
    
    if (!confirm(confirmMessage)) {
      return; // User cancelled
    }
    
    const payload = symbol ? { symbol } : {};
    
    // Show loading indicator
    const executeButton = document.getElementById('confirm-force-trade');
    const originalText = executeButton.textContent;
    executeButton.textContent = 'Executing...';
    executeButton.disabled = true;
    
    fetch('/api/force-trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
      // Reset button
      executeButton.textContent = originalText;
      executeButton.disabled = false;
      
      // Close modal
      const modalElement = document.getElementById('force-trade-modal');
      const modal = bootstrap.Modal.getInstance(modalElement);
      modal.hide();
      
      if (data.status && data.status.includes('executed')) {
        // Use a more prominent alert for successful trades
        showAlert('success', 'Forced Trade Executed', `Successfully executed forced trade for ${data.symbol}`, 10000);
      } else if (data.status && data.status.includes('Position already exists')) {
        showAlert('warning', 'No Trade', `${data.status}. Please select a different symbol.`);
      } else if (data.status && data.status.includes('No available')) {
        showAlert('warning', 'No Trade', 'All symbols already have open positions. Close some positions first.');
      } else if (data.error) {
        showAlert('danger', 'Error', data.error);
      } else {
        showAlert('info', 'Status', data.status || 'Unknown response from server');
      }
    })
    .catch(error => {
      // Reset button
      executeButton.textContent = originalText;
      executeButton.disabled = false;
      
      console.error('Error executing forced trade:', error);
      showAlert('danger', 'Error', 'Failed to execute trade: ' + error.message);
    });
  }
  
  // Close a position
  function closePosition(symbol) {
    if (!confirm(`Are you sure you want to close position for ${symbol}?`)) {
      return;
    }
    
    fetch(`/api/positions/${symbol}/close`, {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        delete state.positions[symbol];
        updatePositionsTable(state.positions);
        showAlert('success', 'Position Closed', `Successfully closed position for ${symbol}`);
      } else {
        showAlert('danger', 'Error', data.error || 'Failed to close position');
      }
    })
    .catch(error => {
      console.error('Error closing position:', error);
      showAlert('danger', 'Error', 'Failed to close position');
    });
  }
  
  // Show settings modal
  function showSettingsModal() {
    // Populate form with current settings
    populateSettingsForm();
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('settings-modal'));
    modal.show();
  }
  
  // Populate settings form with current config
  function populateSettingsForm() {
    if (!state.config) return;
    
    document.getElementById('settings-account-balance').value = state.config.accountBalance;
    document.getElementById('settings-risk-percent').value = state.config.riskPercent * 100;
    document.getElementById('settings-stop-loss').value = state.config.stopLossPct * 100;
    document.getElementById('settings-take-profit').value = state.config.takeProfitPct * 100;
    document.getElementById('settings-trailing-stop').value = state.config.trailingStopPct * 100;
    document.getElementById('settings-dry-run').checked = state.config.dryRun;
    document.getElementById('settings-api-endpoint').value = state.config.baseUrl;
    document.getElementById('settings-signal-threshold').value = 3; // Default
    document.getElementById('settings-symbols').value = state.config.symbolList.join(', ');
  }
  
  // Save settings
  function saveSettings() {
    const settings = {
      accountBalance: parseFloat(document.getElementById('settings-account-balance').value),
      riskPercent: parseFloat(document.getElementById('settings-risk-percent').value) / 100,
      stopLossPct: parseFloat(document.getElementById('settings-stop-loss').value) / 100,
      takeProfitPct: parseFloat(document.getElementById('settings-take-profit').value) / 100,
      trailingStopPct: parseFloat(document.getElementById('settings-trailing-stop').value) / 100,
      dryRun: document.getElementById('settings-dry-run').checked,
      symbolList: document.getElementById('settings-symbols').value.split(',').map(s => s.trim()),
      signalThreshold: parseInt(document.getElementById('settings-signal-threshold').value)
    };
    
    fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        state.config = data.config;
        
        // Close modal
        const modalElement = document.getElementById('settings-modal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        showAlert('success', 'Settings Saved', 'Bot settings updated successfully');
      } else {
        showAlert('danger', 'Error', data.error || 'Failed to update settings');
      }
    })
    .catch(error => {
      console.error('Error saving settings:', error);
      showAlert('danger', 'Error', 'Failed to update settings');
    });
  }
  
  // Refresh all data
  function refreshAllData() {
    fetchInitialData();
    showAlert('info', 'Refreshing', 'Data refresh initiated');
  }
  
  // Show alert message
  function showAlert(type, title, message) {
    const alertContainer = document.getElementById('alert-container');
    const alertId = 'alert-' + Date.now();
    
    const alertHtml = `
      <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
        <strong>${title}:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHtml);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      const alertElement = document.getElementById(alertId);
      if (alertElement) {
        const alert = bootstrap.Alert.getOrCreateInstance(alertElement);
        alert.close();
      }
    }, 5000);
  }
  
  // Helper function to generate random colors for charts
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  
  // Initialize the dashboard
  init();
});
