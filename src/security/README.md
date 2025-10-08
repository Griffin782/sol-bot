# SOL-BOT Security System

## Overview

The SOL-BOT Security System provides comprehensive protection for the trading bot including IP management, intrusion detection, hardware wallet emergency flush, and trading integration hooks.

## Components

### 1. SecurityManager (`securityManager.ts`)
Core security engine that handles:
- IP whitelisting/blacklisting
- Authentication failure tracking
- Intrusion detection
- Emergency response protocols
- Hardware wallet flush capability

### 2. Security Integration (`securityIntegration.ts`)
Easy-to-use integration layer for the main trading bot:
- Pre-trade security checks
- Trading activity logging
- System status monitoring
- Admin controls

## Key Features

### Step 1: Core IP Management ✅
- **IP Whitelisting**: Trusted IPs (VPS: 104.171.163.149, PC: 67.184.226.84, localhost)
- **IP Blacklisting**: Automatic blocking of suspicious IPs
- **Intrusion Detection**: Pattern recognition for MULTIPLE_RAPID, PERSISTENT, SUSPICIOUS_TIMING attacks
- **Security Event Logging**: Comprehensive audit trail in JSONL format

### Step 2: Alert System ✅
- **3-Attempt Threshold**: Updated from 1 to 3 failed attempts within 5-minute window
- **SMS Alerts**: Twilio and AWS SNS provider support
- **Email Notifications**: SMTP configuration with rich templates
- **Alert Templates**: Pre-configured messages for different event types

### Step 3: Emergency Response & Bot Integration ✅
- **Hardware Wallet Emergency Flush**: Automatic fund transfer on security breach
- **Trading Halt Mechanism**: Suspend all trading during security events
- **Bot Integration Hooks**: Pre-trade security checks and activity logging
- **System Status Monitoring**: Real-time security status for trading decisions

## Configuration

### Security Config (`data/security_config.json`)
```json
{
  "whitelist": {
    "enabled": true,
    "allowedIPs": ["127.0.0.1", "::1", "104.171.163.149", "67.184.226.84"]
  },
  "authentication": {
    "maxFailedAttempts": 3,
    "failureWindow": 300
  },
  "emergency": {
    "hardwareWalletFlush": {
      "enabled": true,
      "targetWallet": "YOUR_HARDWARE_WALLET_ADDRESS",
      "minBalanceThreshold": 100
    }
  }
}
```

## Trading Bot Integration

### Basic Usage
```typescript
import { checkTradingAllowed, logBuy, isEmergencyMode } from './security/securityIntegration';

// Before any trade
const securityCheck = await checkTradingAllowed({
  type: 'BUY',
  amount: 100,
  token: 'TOKEN_MINT',
  wallet: 'WALLET_ADDRESS'
});

if (!securityCheck.allowed) {
  console.log(`Trading blocked: ${securityCheck.reason}`);
  return;
}

// After successful trade
await logBuy(100, 'TOKEN_MINT', 'WALLET_ADDRESS');
```

### Security Status Checks
```typescript
import { getSystemStatus, displaySecurityStatus } from './security/securityIntegration';

// Check system status
const status = getSystemStatus();
console.log('Trading allowed:', status.tradingAllowed);
console.log('Risk level:', status.riskLevel);

// Display full status
displaySecurityStatus();
```

## Emergency Protocols

### Automatic Triggers
- **MULTIPLE_INTRUSION**: Multiple simultaneous attack patterns
- **SYSTEM_COMPROMISE**: Critical security breach detected
- **SUSPICIOUS_TRADING_PATTERN**: Unusual trading activity

### Emergency Actions
1. **System Lockdown**: All operations suspended
2. **Trading Halt**: No new trades allowed
3. **Hardware Wallet Flush**: Funds transferred to secure wallet (if configured)
4. **Alert Notifications**: SMS/Email alerts sent immediately

### Manual Controls
```typescript
import { triggerEmergency, resumeTrading } from './security/securityIntegration';

// Manually trigger emergency
await triggerEmergency('MANUAL_SECURITY_REVIEW');

// Resume after verification
resumeTrading('Admin verified system is secure');
```

## Security Events

All security events are logged to `data/security_events.jsonl` with:
- **Timestamp**: ISO format
- **Event Type**: AUTH_FAILURE, IP_BLOCKED, INTRUSION_DETECTED, etc.
- **Source IP**: Origin of the event
- **Severity**: LOW, MEDIUM, HIGH, CRITICAL
- **Actions Taken**: Automated responses

## Risk Levels

- **LOW**: Normal operation
- **MEDIUM**: Elevated monitoring (10+ events/hour)
- **HIGH**: High security activity (3+ high-severity events)
- **CRITICAL**: Emergency conditions (any critical events)

## Monitoring & Maintenance

### Status Display
```bash
# Check security status
node -e "require('./dist/src/security/securityIntegration').displaySecurityStatus()"
```

### Configuration Updates
- Modify `data/security_config.json`
- Restart the system to apply changes
- Monitor logs for configuration loading

### Alert Configuration
1. **SMS Setup**: Configure Twilio or AWS SNS credentials
2. **Email Setup**: Configure SMTP server settings
3. **Hardware Wallet**: Set target wallet address for emergency flush

## Testing

The security system includes comprehensive test suites:
- Authentication threshold testing
- Emergency response simulation
- Trading integration validation
- Alert system verification

## Security Best Practices

1. **Regular Monitoring**: Check security events daily
2. **IP Management**: Keep whitelist updated with trusted IPs
3. **Emergency Testing**: Periodically test emergency flush (in safe environment)
4. **Alert Configuration**: Ensure SMS/email alerts are properly configured
5. **Hardware Wallet**: Keep emergency wallet address current and secure

## Troubleshooting

### Common Issues
- **Trading Blocked**: Check system status and recent events
- **Alert Failures**: Verify SMS/email credentials
- **Emergency Mode**: Use admin controls to resume after verification
- **Configuration Errors**: Check JSON syntax in config files

### Recovery Procedures
1. Check security event logs for root cause
2. Verify system is not under active attack
3. Use manual controls to resume operations
4. Update configuration if needed
5. Monitor for 24 hours after resumption