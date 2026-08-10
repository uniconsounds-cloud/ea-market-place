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

# Check if paths contain spaces (which MetaEditor CLI fails to compile)
HAS_SPACES=false
if [[ "$MT5_DIR_NAME" == *" "* || "$FILE_NAME" == *" "* ]]; then
    HAS_SPACES=true
fi

if [ "$HAS_SPACES" = true ]; then
    # We will use temporary space-free paths for compilation
    TEMP_DIR_NAME="Experts/temp_compile_dir"
    TEMP_FILE_NAME=$(echo "$FILE_NAME" | sed 's/ /_/g')
    
    echo "Paths contain spaces. Compiling using temporary space-free path: $TEMP_DIR_NAME/$TEMP_FILE_NAME"
    
    # Ensure temp dir exists
    mkdir -p "$MT5_INSTALL_DIR/MQL5/$TEMP_DIR_NAME"
    
    # Copy target MQ5 source file to temp dir with space-free name
    cp "$SOURCE_FILE" "$MT5_INSTALL_DIR/MQL5/$TEMP_DIR_NAME/$TEMP_FILE_NAME"
    
    # Copy MQH dependencies from original workspace dir to temp dir
    cp "$WORKSPACE_DIR/$DIR_NAME"/*.mqh "$MT5_INSTALL_DIR/MQL5/$TEMP_DIR_NAME/" 2>/dev/null || true
    
    # If in subdirectory of Experts, copy parent Experts MQH files
    if [ "$DIR_NAME" != "Experts" ] && [[ "$DIR_NAME" == Experts/* ]]; then
        cp "$WORKSPACE_DIR"/Experts/*.mqh "$MT5_INSTALL_DIR/MQL5/Experts/" 2>/dev/null || true
    fi
    
    # Use temp paths for compiling
    COMPILE_DIR_NAME="$TEMP_DIR_NAME"
    COMPILE_FILE_NAME="$TEMP_FILE_NAME"
else
    # Compile directly
    mkdir -p "$MT5_INSTALL_DIR/MQL5/$MT5_DIR_NAME"
    cp "$SOURCE_FILE" "$MT5_INSTALL_DIR/MQL5/$MT5_DIR_NAME/$FILE_NAME"
    cp "$WORKSPACE_DIR/$DIR_NAME"/*.mqh "$MT5_INSTALL_DIR/MQL5/$MT5_DIR_NAME/" 2>/dev/null || true
    if [ "$DIR_NAME" != "Experts" ] && [[ "$DIR_NAME" == Experts/* ]]; then
        cp "$WORKSPACE_DIR"/Experts/*.mqh "$MT5_INSTALL_DIR/MQL5/Experts/" 2>/dev/null || true
    fi
    COMPILE_DIR_NAME="$MT5_DIR_NAME"
    COMPILE_FILE_NAME="$FILE_NAME"
fi

# 5. Compile using MT5's Wine runtime
echo "Compiling $COMPILE_FILE_NAME via Wine..."
cd "$MT5_INSTALL_DIR"

WINDOWS_SOURCE_PATH=$(echo "MQL5/$COMPILE_DIR_NAME/$COMPILE_FILE_NAME" | sed 's/\//\\/g')
WINDOWS_LOG_PATH=$(echo "MQL5/Logs/${COMPILE_FILE_NAME%.mq5}_compile.log" | sed 's/\//\\/g')

WINEPREFIX="$MT5_WINE_PREFIX" "$WINE64_EXE" "MetaEditor64.exe" \
    /portable \
    /compile:"$WINDOWS_SOURCE_PATH" \
    /log:"$WINDOWS_LOG_PATH"

# 6. Read and decode the UTF-16LE compiler log
LOG_PATH="$MT5_INSTALL_DIR/MQL5/Logs/${COMPILE_FILE_NAME%.mq5}_compile.log"
if [ -f "$LOG_PATH" ]; then
    echo "==================== COMPILE LOG ===================="
    iconv -f UTF-16LE -t UTF-8 "$LOG_PATH"
    echo "====================================================="
else
    echo "Error: Compile log not generated."
    exit 1
fi

# 7. Verify and copy back
compiled_ex5="${COMPILE_FILE_NAME%.mq5}.ex5"
MT5_EX5_PATH="$MT5_INSTALL_DIR/MQL5/$COMPILE_DIR_NAME/$compiled_ex5"

# Target output files
original_ex5="${FILE_NAME%.mq5}.ex5"
MT5_TARGET_EX5_PATH="$MT5_INSTALL_DIR/MQL5/$MT5_DIR_NAME/$original_ex5"
WORKSPACE_TARGET_EX5_PATH="$WORKSPACE_DIR/$DIR_NAME/$original_ex5"

if [ -f "$MT5_EX5_PATH" ]; then
    echo "Success! Compiled file found: $compiled_ex5"
    
    # If we used space-free temp paths, copy to the final MT5 destination
    if [ "$HAS_SPACES" = true ]; then
        mkdir -p "$MT5_INSTALL_DIR/MQL5/$MT5_DIR_NAME"
        cp "$MT5_EX5_PATH" "$MT5_TARGET_EX5_PATH"
        # Cleanup temp directory
        rm -rf "$MT5_INSTALL_DIR/MQL5/$TEMP_DIR_NAME"
    fi
    
    # Copy back to workspace
    cp "$MT5_TARGET_EX5_PATH" "$WORKSPACE_TARGET_EX5_PATH"
    echo "Copied compiled file back to workspace: mt5_integration/$DIR_NAME/$original_ex5"
    exit 0
else
    echo "Failure: Compiled file $compiled_ex5 was not generated."
    # Cleanup temp directory just in case
    if [ "$HAS_SPACES" = true ]; then
        rm -rf "$MT5_INSTALL_DIR/MQL5/$TEMP_DIR_NAME"
    fi
    exit 1
fi
