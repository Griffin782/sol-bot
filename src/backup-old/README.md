# Backup-Old System

This directory contains the backup and version control system for the SOL trading bot.

## Purpose

The backup-old system provides:
- **Version Control**: Track changes to critical files
- **Rollback Capability**: Restore previous working versions
- **Disaster Recovery**: Protect against configuration corruption
- **Development Safety**: Safe experimentation with ability to revert

## Directory Structure

```
backup-old/
├── versions/
│   ├── critical/           # Critical system backups (index.ts, config.ts, etc.)
│   ├── daily/             # Scheduled daily backups
│   ├── config/            # Configuration file backups
│   └── trading/           # Trading data backups
├── backup_history.json    # Complete backup log
├── rollback_points.json   # Available rollback points
├── backup_registry.json   # System configuration
└── README.md             # This file
```

## Critical Files Protected

- `src/index.ts` - Main trading bot logic
- `src/config.ts` - Core configuration
- `src/configBridge.ts` - Configuration bridge
- `src/enhanced/masterConfig.ts` - Master configuration
- `src/enhanced/token-queue-system.ts` - Token queue system
- `src/security/securityManager.ts` - Security system
- `src/security/securityIntegration.ts` - Security integration
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration

## Usage

### Automatic Backups
The system automatically creates backups:
- Before major configuration changes
- Daily scheduled backups
- Before security system updates
- Pre-deployment backups

### Manual Backups
```typescript
import { BackupManager } from './utils/managers/backupManager';

const backup = new BackupManager();

// Backup critical files
backup.backupCriticalFiles('Before major update');

// Backup trading data
backup.backupTradingData('End of session');

// Backup configuration
backup.backupConfigFiles('Config optimization');
```

### Rollback Operations
```typescript
// List available rollback points
const points = backup.listRollbackPoints();

// Rollback to previous version
backup.rollbackToPoint('critical_2025-08-27T09-30-00', true);
```

## Rollback Points

Critical rollback points are created for:
- Major system updates
- Security system changes
- Configuration optimizations
- Pre-deployment states

## Maintenance

### Cleanup Old Backups
```typescript
// Clean backups older than 30 days (keeps critical ones longer)
backup.cleanupOldBackups(30);
```

### Backup Statistics
```typescript
// Get system statistics
const stats = backup.getBackupStats();
console.log('Total backups:', stats.totalBackups);
console.log('Storage used:', stats.totalSize);
```

## Integration

The backup system integrates with:
- **Advanced Bot Manager**: Auto-backup before major changes
- **Security Manager**: Backup before security updates
- **Session Manager**: Backup on session completion
- **Configuration System**: Backup on config changes

## Important Notes

1. **Critical backups** are retained longer than standard backups
2. **Pre-rollback backups** are created automatically before rollback operations
3. **Metadata files** contain backup verification information
4. **Rollback confirmation** required for safety
5. **Directory permissions** must allow read/write access

## File Exclusions

The following are intentionally excluded from TypeScript compilation (see `tsconfig.json`):
- `src/backup-old/**/*` - This prevents backup files from being compiled

This exclusion is by design to keep backup files as pure source copies without TypeScript processing.