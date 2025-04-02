#!/bin/bash
# MEXC Trading Bot Termux Setup Script
# This script will set up the full-featured MEXC trading bot on Termux

# Print colored messages
print_blue() {
    echo -e "\e[34m$1\e[0m"
}
print_green() {
    echo -e "\e[32m$1\e[0m"
}
print_red() {
    echo -e "\e[31m$1\e[0m"
}
print_yellow() {
    echo -e "\e[33m$1\e[0m"
}

# Setup banner
print_blue "========================================"
print_blue "   MEXC Trading Bot - Termux Setup      "
print_blue "========================================"
echo ""

# Check if Termux
if [ ! -d "/data/data/com.termux" ] && [ ! -d "/data/data/com.termux.nightly" ]; then
    print_red "This script is designed to be run in Termux on Android."
    print_red "If you're running on a different platform, you can still use the commands manually."
    echo ""
fi

# Update package repositories
print_yellow "Step 1: Updating package repositories..."
pkg update -y && pkg upgrade -y
if [ $? -ne 0 ]; then
    print_red "Failed to update packages. Please check your internet connection and try again."
    exit 1
fi
print_green "Package repositories updated successfully."
echo ""

# Install required packages
print_yellow "Step 2: Installing required packages..."
pkg install -y nodejs git termux-api
if [ $? -ne 0 ]; then
    print_red "Failed to install required packages."
    exit 1
fi
print_green "Required packages installed successfully."
echo ""

# Set up storage access
print_yellow "Step 3: Setting up storage access..."
termux-setup-storage
print_yellow "Please grant storage permission if prompted."
sleep 3
echo ""

# Create project directory
print_yellow "Step 4: Creating project directory..."
mkdir -p ~/mexc-trading-bot
cd ~/mexc-trading-bot
print_green "Project directory created successfully."
echo ""

# Clone or copy files
print_yellow "Step 5: Setting up bot files..."
echo "Would you like to:"
echo "1. Clone from GitHub repository (if you've created one)"
echo "2. Copy from internal storage (if you've transferred the files)"
read -p "Enter your choice (1 or 2): " file_choice

if [ "$file_choice" == "1" ]; then
    read -p "Enter your GitHub repository URL: " repo_url
    git clone "$repo_url" .
    if [ $? -ne 0 ]; then
        print_red "Failed to clone repository. Please check the URL and try again."
        exit 1
    fi
    print_green "Repository cloned successfully."
elif [ "$file_choice" == "2" ]; then
    print_yellow "Please ensure you've copied the mexc-trading-bot folder to your internal storage."
    print_yellow "Copying files from internal storage..."
    cp -r /storage/emulated/0/mexc-trading-bot/* .
    if [ $? -ne 0 ]; then
        print_red "Failed to copy files. Please ensure the files are in the correct location."
        exit 1
    fi
    print_green "Files copied successfully."
else
    print_red "Invalid choice. Exiting."
    exit 1
fi
echo ""

# Install dependencies
print_yellow "Step 6: Installing Node.js dependencies..."
npm install
if [ $? -ne 0 ]; then
    print_red "Failed to install dependencies."
    exit 1
fi
print_green "Dependencies installed successfully."
echo ""

# Check for .env file
print_yellow "Step 7: Checking for environment configuration..."
if [ ! -f ".env" ]; then
    print_yellow "Creating .env file..."
    cat > .env << EOF
# MEXC API Credentials
API_KEY=mx0vgluzHUVwDXFZBX
API_SECRET=f05ed3617ebf42d98ade54bceb839bd2
BASE_URL=https://api.mexc.com

# Bot Configuration
DRY_RUN=true
ACCOUNT_BALANCE=150
RISK_PERCENT=1
STOP_LOSS_PCT=2
TAKE_PROFIT_PCT=5
TRAILING_STOP_PCT=1
ATR_THRESHOLD=1.0

# Web Server
PORT=3000
EOF
    print_green ".env file created successfully."
else
    print_green ".env file already exists."
fi
echo ""

# Create start script
print_yellow "Step 8: Creating start scripts..."
cat > start-bot.sh << EOF
#!/bin/bash
echo "Starting MEXC Trading Bot..."
node src/fullFeaturedBot.js
EOF
chmod +x start-bot.sh

cat > start-with-tmux.sh << EOF
#!/bin/bash
echo "Starting MEXC Trading Bot in a tmux session..."
tmux new-session -d -s mexc_bot 'node src/fullFeaturedBot.js'
echo "Bot started in background. To view the bot:"
echo "1. Run: tmux attach -t mexc_bot"
echo "2. To detach while keeping the bot running: Press Ctrl+b then d"
EOF
chmod +x start-with-tmux.sh

# Create a simplified README with instructions
cat > README_TERMUX.md << EOF
# MEXC Trading Bot - Termux Instructions

## Running the Bot

There are two ways to run the trading bot:

### 1. Standard mode
This runs the bot in the current terminal session:
```
./start-bot.sh
```
The bot will stop if you close Termux.

### 2. Background mode with tmux
This runs the bot in a detachable session that continues running even if you close Termux:
```
pkg install tmux
./start-with-tmux.sh
```

To view the running bot:
```
tmux attach -t mexc_bot
```

To detach from tmux (bot keeps running):
- Press Ctrl+b, then d

To kill the tmux session:
```
tmux kill-session -t mexc_bot
```

## Accessing the Web Dashboard

The web dashboard is available at:
http://localhost:3000

To access this from your tablet's browser, use:
http://127.0.0.1:3000

## Important Safety Features

- Kill Switch: Immediately stops all trading activity
- Maximum Position Size: Limits the size of any single trade
- Daily Loss Limit: Automatically stops trading if daily losses exceed the configured limit
- Emergency Close: Closes all open positions at current market prices

## Adjusting Settings

Edit the .env file to customize your configuration:
```
nano .env
```
EOF

print_green "Start scripts and README created successfully."
echo ""

# Final message
print_green "========================================"
print_green "   MEXC Trading Bot setup complete!     "
print_green "========================================"
echo ""
print_yellow "To start the bot, run:"
echo "./start-bot.sh"
echo ""
print_yellow "To run in background (after installing tmux):"
echo "./start-with-tmux.sh"
echo ""
print_yellow "For more information, see the README_TERMUX.md file."
echo ""
print_blue "Happy trading! Remember to start in DRY_RUN mode (DRY_RUN=true in .env) to test before using real funds."
