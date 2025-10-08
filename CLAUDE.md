# SOL-BOT v5.0 Project Memory

## 🚨 CRITICAL CONTEXT
@RECENT_CHATS_CONTEXT.md

## 🧑‍💻 USER PROFILE
- **Skill Level**: Novice coder with good concepts
- **Needs**: Exact file locations, line numbers, "find this/replace with" format
- **Environment**: Windows PowerShell, VS Code
- **Current Crisis**: -99.8% ROI due to config import failures

## 🚨 CRITICAL CONTEXT
@RECENT_CHATS_CONTEXT.md

## 🧑‍💻 USER PROFILE
- **Skill Level**: Novice coder with good concepts
- **Needs**: Exact file locations, line numbers, "find this/replace with" format
- **Environment**: Windows PowerShell, VS Code
- **Current Crisis**: -99.8% ROI due to config import failures

## 📁 PROJECT STRUCTURE

sol-bot-main/
├── src/
│   ├── index.ts                 # Main controller (loads from z-new-controls!)
│   ├── config.ts                # Config bridge
│   ├── enhanced/
│   │   ├── masterConfig.ts      # Secondary config (line 331)
│   │   ├── token-queue-system.ts # Pool manager
│   │   └── performanceLogger.ts # 5x+ tracking
│   ├── z-new-controls/          # 🚨 ACTIVE CONFIG LOCATION!
│   │   ├── z-masterConfig.ts    # PRIMARY config (line 143) - BEING USED
│   │   ├── z-configBridge.ts    # Config bridge
│   │   └── z-index.ts           # Main controller variant
│   ├── tax-compliance/          # Tax reporting
│   ├── wallets/                 # Wallet management
│   └── utils/handlers/          # Utility functions
├── data/                        # Output CSV files
└── .env                         # Environment variables

# User is novice coder - needs exact file locations and line numbers
# Critical issue: masterConfig.ts values not being imported properly
# Bot lost $599 of $600 due to duplicates and config failures
# Always use "find this/replace with" format for code changes
# Project has catastrophic -99.8% ROI due to config import failure
# 462 duplicate tokens means duplicate protection is completely broken
# Hardcoded values in src/index.ts are overriding masterConfig.ts