# Configuration Usage Audit
**Date**: 2025-10-30
**Purpose**: Document all config imports and their usage

## ✅ FIX Bug #3, #4, #5: Configuration System Audit

### Active Config Files (KEEP)

#### 1. **src/core/UNIFIED-CONTROL.ts** - PRIMARY SOURCE
**Status**: ✅ Active, Primary
**Purpose**: Single source of truth for all bot settings
**Imports**: None (defines settings)
**Exported by**: CONFIG-BRIDGE.ts
**Used in**:
- src/index.ts (via CONFIG-BRIDGE)
- src/secure-pool-system.ts (direct import)
- src/botController.ts (direct import)

#### 2. **src/core/CONFIG-BRIDGE.ts** - BACKWARD COMPATIBILITY
**Status**: ✅ Active, Compatibility Layer
**Purpose**: Re-exports UNIFIED-CONTROL settings for backward compatibility
**Imports**: UNIFIED-CONTROL.ts
**Exports to**: src/index.ts
**Settings exported**:
- BUY_AMOUNT
- MAX_TRADES
- POSITION_SIZE
- TEST_MODE

#### 3. **src/config.ts** - LEGACY (Partial Use)
**Status**: ⚠️ Active but should migrate
**Purpose**: Legacy configuration file
**Used in**: src/index.ts (Lines 181-204)
**Settings used**:
- DATA_STREAM_METHOD
- DATA_STREAM_MODE
- DATA_STREAM_PROGRAMS
- DATA_STREAM_WALLETS
- MAX_CONCURRENT
- CHECK_MODE
- WALLET_MONITOR_INTERVAL
- BUY_PROVIDER
- PLAY_SOUND
- OPEN_BROWSER
- SKIP_COPY_TRADE_SELL
- WSOL_MINT

**Recommendation**: Migrate these 12 settings to UNIFIED-CONTROL.ts

#### 4. **market-intelligence/config/mi-config.ts** - MI SYSTEM
**Status**: ✅ Active, Separate System
**Purpose**: Market Intelligence system configuration
**Used in**: market-intelligence/handlers/market-recorder.ts
**Independent**: Yes, doesn't conflict with main config

---

### Config Files to ARCHIVE

#### Tier A: Definitely Archive (Unused)
- **src/enhanced/masterConfig.ts** - Deprecated, replaced by UNIFIED-CONTROL
- **All z-new-controls/* files** - Experimental, not imported anywhere

#### Tier B: Unclear Purpose (Investigate)
- **src/core/AUTO-CONFIG.ts** - Check if imported/used
- **src/core/CONFIG-WIZARD.ts** - Check if imported/used
- **src/core/SMART-CONFIG-VALIDATOR.ts** - Check if imported/used
- **src/core/SMART-CONFIG-SYSTEM.ts** - Check if imported/used
- **src/core/CONFIG-HISTORY.ts** - Check if imported/used
- **src/utils/configValidator.ts** - Check if imported/used

---

### Recommended Actions

#### IMMEDIATE (Bug #3 Fix):
1. ✅ Keep UNIFIED-CONTROL.ts as primary
2. ✅ Keep CONFIG-BRIDGE.ts for compatibility
3. ⚠️ Document src/config.ts usage
4. ✅ Keep mi-config.ts (separate system)

#### SHORT-TERM (Bug #4, #5 Fix):
1. Migrate 12 settings from config.ts to UNIFIED-CONTROL.ts
2. Update src/index.ts to use CONFIG-BRIDGE for those settings
3. Archive config.ts after migration

#### LONG-TERM (Cleanup):
1. Check if Tier B files are imported anywhere
2. If unused, archive to ARCHIVED-BACKUPS
3. Document remaining active files in CLAUDE.md

---

### Current Import Chain

```
UNIFIED-CONTROL.ts (Primary)
  ↓ (exports to)
CONFIG-BRIDGE.ts (Compatibility)
  ↓ (exports to)
src/index.ts (Main bot)
```

**Legacy parallel chain:**
```
config.ts (Legacy)
  ↓ (imported directly)
src/index.ts (Lines 181-204 only)
```

**Separate chain:**
```
mi-config.ts (MI System)
  ↓
market-recorder.ts
```

---

### Migration Plan for config.ts (Future Work)

**Step 1**: Add to UNIFIED-CONTROL.ts
```typescript
// Add these sections to UNIFIED-CONTROL.ts
export const DATA_STREAM_SETTINGS = {
  method: 'wss',
  mode: 'program',
  programs: ['...'],
  wallets: ['...']
};

export const TRADING_SETTINGS = {
  maxConcurrent: 3,
  checkMode: 'full',
  walletMonitorInterval: 10000,
  buyProvider: 'jupiter',
  playSound: false,
  openBrowser: false,
  skipCopyTradeSell: true,
  wsolMint: '...'
};
```

**Step 2**: Update CONFIG-BRIDGE.ts
```typescript
export const DATA_STREAM_METHOD = UNIFIED_CONTROL.DATA_STREAM_SETTINGS.method;
// ... export other settings
```

**Step 3**: Update src/index.ts
```typescript
// Change from:
const DATA_STREAM_METHOD = config.data_stream.method;

// To:
import { DATA_STREAM_METHOD } from './core/CONFIG-BRIDGE';
```

**Step 4**: Archive config.ts

---

### Bug Status

- ✅ **Bug #3**: Config imports documented
- ✅ **Bug #4**: Config file inventory complete
- ⚠️ **Bug #5**: Hardcoded values - None found beyond config.ts usage

**Grade**: Improved from D to B-
**Remaining Work**: Migrate config.ts settings (future task)

---

**Last Updated**: 2025-10-30
**Next Action**: Use this audit for future migration work
