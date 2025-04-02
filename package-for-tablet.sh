#!/bin/bash
# Package the MEXC Trading Bot for easy transfer to tablet

# Define colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}    MEXC Trading Bot - Packaging for Tablet       ${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""

# Create a directory for the packaged files
mkdir -p mexc-bot-package

# Copy all necessary files
echo -e "${GREEN}Copying project files...${NC}"
cp -r src/ mexc-bot-package/
cp -r .env mexc-bot-package/
cp -r package.json mexc-bot-package/
cp -r .gitignore mexc-bot-package/
cp -r termux-setup.sh mexc-bot-package/
cp -r TABLET_SETUP_GUIDE.txt mexc-bot-package/
cp -r QUICK_START_SIMPLIFIED.txt mexc-bot-package/

# Make the setup script executable
chmod +x mexc-bot-package/termux-setup.sh

# Check for node_modules and warn if it's large
if [ -d "node_modules" ]; then
    SIZE=$(du -sh node_modules | cut -f1)
    echo -e "${RED}Warning: node_modules directory is ${SIZE} in size${NC}"
    echo -e "${RED}It's recommended to exclude it from the package${NC}"
    echo -e "${RED}You can install dependencies on your tablet using the setup script${NC}"
    
    echo -e "Would you like to include node_modules? (y/n)"
    read -r INCLUDE_MODULES
    
    if [[ "$INCLUDE_MODULES" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Including node_modules in package...${NC}"
        cp -r node_modules mexc-bot-package/
    else
        echo -e "${GREEN}Excluding node_modules from package${NC}"
    fi
fi

# Create a zip file
ZIP_FILE="mexc-bot-package.zip"
echo -e "${GREEN}Creating zip file...${NC}"
if command -v zip &> /dev/null; then
    zip -r "$ZIP_FILE" mexc-bot-package/
    echo -e "${GREEN}Successfully created ${ZIP_FILE}${NC}"
else
    echo -e "${RED}zip command not found. Please manually compress the mexc-bot-package folder.${NC}"
fi

# Cleanup
echo -e "${GREEN}Cleaning up temporary files...${NC}"
rm -rf mexc-bot-package/

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}Package created successfully!${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo -e "Transfer ${ZIP_FILE} to your tablet's internal storage."
echo -e "Follow the instructions in TABLET_SETUP_GUIDE.txt to set up the bot."
echo ""
echo -e "${RED}IMPORTANT: ALWAYS TEST IN DRY RUN MODE FIRST!${NC}"
