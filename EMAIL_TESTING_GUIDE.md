# SOL-BOT Email Testing Guide

## Overview
This guide shows how to test the SOL-BOT security system's email functionality without triggering actual security events.

## Quick Start

### 1. Install Dependencies
```bash
npm install nodemailer
```

### 2. Configure Email Settings
Update `dist/data/security_config.json` with your email credentials:

```json
{
  "alerts": {
    "email": {
      "enabled": true,
      "emailAddress": "ws15day@gmail.com",
      "smtpConfig": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "your-email@gmail.com",
          "pass": "your-app-password"
        }
      }
    }
  }
}
```

### 3. Run Email Test
```bash
node send_test_email.js
```

## Gmail Configuration

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-factor authentication if not already enabled

### Step 2: Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" as the app type
3. Generate a new password
4. Copy the generated 16-character password

### Step 3: Update Configuration
Replace the placeholder values in `security_config.json`:
- `"user": "your-actual-email@gmail.com"`
- `"pass": "your-16-character-app-password"`

## Test Results

### Successful Configuration
When properly configured, you'll see:
```
✅ SMTP connection successful!
✅ Email sent successfully!
📬 Check your inbox at ws15day@gmail.com
```

### Configuration Issues
Common problems and solutions:

#### Missing Credentials
```
⚠️ SMTP credentials not configured!
```
**Solution**: Update the `user` and `pass` fields in security_config.json

#### Connection Failed
```
❌ SMTP connection failed: Authentication failed
```
**Solutions**:
- Verify your app password is correct
- Ensure 2-factor authentication is enabled
- Check that "Less secure app access" is disabled

#### Network Issues
```
❌ SMTP connection failed: connect ECONNREFUSED
```
**Solutions**:
- Check internet connectivity
- Verify firewall settings allow SMTP (port 587)
- Try using port 465 with secure: true

## Email Templates

The system includes four email template types:

### 1. Test Message
- **Subject**: 🧪 SOL-BOT Security System Email Test
- **Purpose**: Verify SMTP configuration
- **Variables**: `{timestamp}`, `{testType}`, `{systemStatus}`

### 2. Intrusion Alert
- **Subject**: 🚨 SOL-BOT Security Alert: Intrusion Detected
- **Purpose**: Alert on security breaches
- **Variables**: `{sourceIP}`, `{pattern}`, `{timestamp}`, `{actions}`

### 3. Emergency Event
- **Subject**: 🚨 SOL-BOT EMERGENCY: Immediate Action Required
- **Purpose**: Critical system events
- **Variables**: `{eventType}`, `{timestamp}`, `{conditions}`, `{actions}`

### 4. Authentication Failure
- **Subject**: ⚠️ SOL-BOT Authentication Alert
- **Purpose**: Multiple login failures
- **Variables**: `{sourceIP}`, `{count}`, `{window}`, `{actions}`

## Testing Different Email Providers

### Gmail (Recommended)
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@gmail.com",
    "pass": "your-app-password"
  }
}
```

### Outlook/Hotmail
```json
{
  "host": "smtp-mail.outlook.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@outlook.com",
    "pass": "your-password"
  }
}
```

### Yahoo Mail
```json
{
  "host": "smtp.mail.yahoo.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@yahoo.com",
    "pass": "your-app-password"
  }
}
```

### Custom SMTP
```json
{
  "host": "mail.your-domain.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "security@your-domain.com",
    "pass": "your-password"
  }
}
```

## Security Integration Testing

### Manual Test Email
```javascript
const { SecurityManager } = require('./dist/src/security/securityManager.js');
const security = new SecurityManager();

// Send test alert without triggering security event
await security.sendAlert('testMessage', {
  testType: 'Manual Test',
  systemStatus: 'All Systems Operational'
});
```

### Template Validation
The test script validates:
- ✅ SMTP connection establishment
- ✅ Template variable substitution
- ✅ Email formatting (text and HTML)
- ✅ Delivery confirmation
- ✅ Error handling and troubleshooting

## Troubleshooting

### Common Error Messages

#### "Authentication failed"
- Incorrect email or password
- App password not generated
- 2FA not enabled

#### "Connection timeout"
- Network/firewall issues
- Incorrect SMTP host/port
- ISP blocking SMTP

#### "Message rejected"
- Invalid recipient email
- SMTP server restrictions
- Rate limiting

### Debug Mode
Add debug logging to troubleshoot:
```javascript
const transporter = nodemailer.createTransporter({
  ...smtpConfig,
  debug: true,
  logger: true
});
```

## Integration with Security System

Once email is working, the security system will automatically send:
- **Real-time alerts** on intrusion detection
- **Emergency notifications** on critical events
- **Authentication failure** warnings
- **System status** updates

## Best Practices

1. **Test regularly**: Run email tests weekly
2. **Monitor delivery**: Check spam/junk folders
3. **Update credentials**: Rotate app passwords quarterly
4. **Backup configuration**: Keep secure copies of config
5. **Multiple recipients**: Consider adding backup email addresses

## Support

For additional help:
- Gmail App Passwords: https://support.google.com/accounts/answer/185833
- Outlook App Passwords: https://support.microsoft.com/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification
- SMTP Troubleshooting: Check your email provider's SMTP documentation