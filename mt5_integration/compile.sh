#!/bin/bash

# Configuration
MT5_WINE_PREFIX="/Users/suphakorn/Library/Application Support/net.metaquotes.wine.metatrader5"
MT5_INSTALL_DIR="$MT5_WINE_PREFIX/drive_c/Program Files/MetaTrader 5"
WINE64_EXE="/Applications/MetaTrader 5.app/Contents/SharedSupport/wine/bin/wine64"

# Check arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <relative_path_to_mq5_in_mt5_integration>"
    echo "Example: $0 Experts/EAE_Monitor.mq5"
    echo "Example: $0 Experts/EasyM/EASY_M Max Universal v1.13 0609.mq5"
    exit 1
fi

RELATIVE_PATH="$1"
WORKSPACE_DIR="/Users/suphakorn/EA Market Place/ea-market-place/mt5_integration"
SOURCE_FILE="$WORKSPACE_DIR/$RELATIVE_PATH"

if [ ! -f "$SOURCE_FILE" ]; then
    echo "Error: Source file $SOURCE_FILE not found in workspace."
    exit 1
fi

# 1. Copy all include files from workspace to MT5 installation first to ensure latest deps
echo "Syncing workspace include files to MT5..."
cp -R "$WORKSPACE_DIR"/Include/* "$MT5_INSTALL_DIR/MQL5/Include/"

# 2. Extract directories and file names
FILE_NAME=$(basename "$RELATIVE_PATH")
DIR_NAME=$(dirname "$RELATIVE_PATH")

# Map folder names to match MT5 installation space casing if necessary
# E.g. "Experts/EasyM" in workspace is "Experts/Easy M" in MT5
MT5_DIR_NAME="$DIR_NAME"
if [ "$DIR_NAME" = "Experts/EasyM" ]; then
    MT5_DIR_NAME="Experts/Easy M"
fi

# Ensure the destination subdirectory in MT5 exists (e.g. Experts/Easy M)
mkdir -p "$MT5_INSTALL_DIR/MQL5/$MT5_DIR_NAME"

# 3. Copy the target MQ5 source file to MT5 installation
echo "Copying source file $FILE_NAME to MT5 ($MT5_DIR_NAME)..."
cp "$SOURCE_FILE" "$MT5_INSTALL_DIR/MQL5/$MT5_DIR_NAME/$FILE_NAME"

# 4. Also copy any other dependencies in the same directory (like EAE_WebSync.mqh in Experts/)
if [ "$DIR_NAME" = "Experts" ]; then
    echo "Copying Experts MQH files to MT5..."
    cp "$WORKSPACE_DIR"/Experts/*.mqh "$MT5_INSTALL_DIR/MQL5/Experts/" 2>/dev/null || true
fi

# 5. Compile using MT5's Wine runtime
echo "Compiling $FILE_NAME via Wine..."
cd "$MT5_INSTALL_DIR"

# Convert Unix directory path separators to Windows backslashes for MetaEditor
WINDOWS_SOURCE_PATH=$(echo "MQL5/$MT5_DIR_NAME/$FILE_NAME" | sed 's/\//\\/g')
WINDOWS_LOG_PATH=$(echo "MQL5/Logs/${FILE_NAME%.mq5}_compile.log" | sed 's/\//\\/g')

WINEPREFIX="$MT5_WINE_PREFIX" "$WINE64_EXE" "MetaEditor64.exe" \
    /portable \
    /compile:"$WINDOWS_SOURCE_PATH" \
    /log:"$WINDOWS_LOG_PATH"

# 6. Read and decode the UTF-16LE compiler log
LOG_PATH="$MT5_INSTALL_DIR/MQL5/Logs/${FILE_NAME%.mq5}_compile.log"
if [ -f "$LOG_PATH" ]; then
    echo "==================== COMPILE LOG ===================="
    iconv -f UTF-16LE -t UTF-8 "$LOG_PATH"
    echo "====================================================="
else
    echo "Error: Compile log not generated."
    exit 1
fi

# 7. Verify the output .ex5 file and copy it back to the workspace
compiled_ex5="${FILE_NAME%.mq5}.ex5"
MT5_EX5_PATH="$MT5_INSTALL_DIR/MQL5/$MT5_DIR_NAME/$compiled_ex5"
WORKSPACE_EX5_PATH="$WORKSPACE_DIR/$DIR_NAME/$compiled_ex5"

if [ -f "$MT5_EX5_PATH" ]; then
    echo "Success! Compiled file found: $compiled_ex5"
    cp "$MT5_EX5_PATH" "$WORKSPACE_EX5_PATH"
    echo "Copied compiled file back to workspace: mt5_integration/$DIR_NAME/$compiled_ex5"
    exit 0
else
    echo "Failure: Compiled file $compiled_ex5 was not generated."
    exit 1
fi
