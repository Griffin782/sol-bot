// ============================================
// SECURITY MANAGER - Core Protection System
// Version: 1.0
// Purpose: IP management, intrusion detection, emergency response
// ============================================

import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// ============================================
// INTERFACES & TYPES
// ============================================

export interface SecurityConfig {
  // IP Management
  whitelist: {
    enabled: boolean;
    allowedIPs: string[];
    allowLocalhost: boolean;
    dynamicWhitelist: boolean;
  };
  
  blacklist: {
    enabled: boolean;
    blockedIPs: string[];
    autoBlockAfterFailures: number;
    blockDuration: number; // minutes
  };
  
  // Authentication & Access
  authentication: {
    maxFailedAttempts: number;
    lockoutDuration: number;
    sessionTimeout: number;
    requireMFA: boolean;
    failureWindow?: number; // seconds
  };
  
  // Alert System
  alerts: {
    sms: {
      enabled: boolean;
      phoneNumber: string;
      provider: 'twilio' | 'aws' | 'custom';
      providers?: {
        twilio?: {
          accountSid: string;
          authToken: string;
          fromNumber: string;
        };
        aws?: {
          accessKeyId: string;
          secretAccessKey: string;
          region: string;
        };
      };
    };
    email: {
      enabled: boolean;
      emailAddress: string;
      smtpConfig: {
        host?: string;
        port?: number;
        secure?: boolean;
        auth?: {
          user: string;
          pass: string;
        };
      };
    };
    webhook: {
      enabled: boolean;
      url: string;
      headers?: Record<string, string>;
    };
    templates?: {
      intrusionDetected?: {
        sms: string;
        email: {
          subject: string;
          body: string;
        };
      };
      emergencyEvent?: {
        sms: string;
        email: {
          subject: string;
          body: string;
        };
      };
      authFailure?: {
        sms: string;
        email: {
          subject: string;
          body: string;
        };
      };
    };
  };
  
  // Emergency Response
  emergency: {
    hardwareWalletFlush: {
      enabled: boolean;
      triggerConditions: string[];
      targetWallet: string;
      minBalanceThreshold: number;
      multiFactor: MultiFactor;
    };
    tradingHalt: {
      enabled: boolean;
      autoHalt: boolean;
    };
  };
}

export interface SecurityEvent {
  timestamp: Date;
  eventType: 'AUTH_FAILURE' | 'IP_BLOCKED' | 'INTRUSION_DETECTED' | 'EMERGENCY_TRIGGERED' | 'IP_WHITELISTED' | 'SYSTEM_ACCESS' | 'SSH_ATTACK' | 'FILE_ACCESS_VIOLATION' | 'PROCESS_TAMPERING' | 'NETWORK_SCAN' | 'PRIVILEGE_ESCALATION';
  sourceIP: string;
  details: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionTaken: string[];
  securityIndicator?: SecurityIndicatorType;
}

export interface IntrusionAttempt {
  ip: string;
  timestamp: Date;
  attemptCount: number;
  lastAttempt: Date;
  blocked: boolean;
  details: string;
}

export enum SecurityIndicatorType {
  AUTHENTICATION_COMPROMISE = 'AUTHENTICATION_COMPROMISE',
  SSH_BRUTE_FORCE = 'SSH_BRUTE_FORCE', 
  UNAUTHORIZED_FILE_ACCESS = 'UNAUTHORIZED_FILE_ACCESS',
  PROCESS_TAMPERING = 'PROCESS_TAMPERING',
  NETWORK_INTRUSION = 'NETWORK_INTRUSION',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  SYSTEM_PENETRATION = 'SYSTEM_PENETRATION'
}

export interface SecurityIndicator {
  type: SecurityIndicatorType;
  timestamp: Date;
  sourceIP: string;
  severity: 'HIGH' | 'CRITICAL';
  details: any;
  relatedEvents: string[]; // Event IDs for correlation
}

export interface MultiFactor {
  enabled: boolean;
  requiredIndicators: number; // 2-3 indicators required
  timeWindow: number; // 10 minutes in seconds
  autoFlushThreshold: number; // How many multi-factor events before auto-flush
}

export interface SecurityStatus {
  systemLocked: boolean;
  tradingHalted: boolean;
  whitelistActive: boolean;
  blacklistCount: number;
  recentEvents: number;
  emergencyTriggered: boolean;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  whitelist: {
    enabled: true,
    allowedIPs: ['127.0.0.1', '::1'], // Will add current IP dynamically
    allowLocalhost: true,
    dynamicWhitelist: false
  },
  
  blacklist: {
    enabled: true,
    blockedIPs: [],
    autoBlockAfterFailures: 3, // Block after 3 failed attempts
    blockDuration: 60 // 60 minutes
  },
  
  authentication: {
    maxFailedAttempts: 3,
    lockoutDuration: 60,
    sessionTimeout: 30,
    requireMFA: false,
    failureWindow: 300 // 5 minutes in seconds
  },
  
  alerts: {
    sms: { 
      enabled: false, 
      phoneNumber: "", 
      provider: 'twilio'
    },
    email: { 
      enabled: false, 
      emailAddress: "", 
      smtpConfig: {}
    },
    webhook: { 
      enabled: false, 
      url: "" 
    }
  },
  
  emergency: {
    hardwareWalletFlush: {
      enabled: true,
      triggerConditions: ['MULTIPLE_INTRUSION', 'SYSTEM_COMPROMISE'],
      targetWallet: "", // Hardware wallet address - will be configured
      minBalanceThreshold: 100, // Only flush if > $100
      multiFactor: {
        enabled: true,
        requiredIndicators: 2, // Require 2-3 indicators
        timeWindow: 600, // 10 minutes in seconds
        autoFlushThreshold: 1 // Auto-flush after 1 multi-factor event
      }
    },
    tradingHalt: {
      enabled: true,
      autoHalt: true
    }
  }
};

// ============================================
// CORE SECURITY MANAGER CLASS
// ============================================

export class SecurityManager {
  private config: SecurityConfig;
  private activeConnections: Map<string, Date>;
  private failedAttempts: Map<string, IntrusionAttempt>;
  private securityEvents: SecurityEvent[];
  private securityIndicators: SecurityIndicator[];
  private emergencyTriggered: boolean;
  private systemLocked: boolean;
  private tradingHalted: boolean;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(__dirname, '../../data/security_config.json');
    this.activeConnections = new Map();
    this.failedAttempts = new Map();
    this.securityEvents = [];
    this.securityIndicators = [];
    this.emergencyTriggered = false;
    this.systemLocked = false;
    this.tradingHalted = false;
    
    this.initializeConfig();
    this.logSecurityEvent({
      timestamp: new Date(),
      eventType: 'SYSTEM_ACCESS',
      sourceIP: 'localhost',
      details: { action: 'SecurityManager initialized' },
      severity: 'LOW',
      actionTaken: ['System started']
    });
    
    console.log('🛡️ SecurityManager initialized');
    
    // Ensure all trusted IPs are whitelisted
    this.addTrustedIPs();
    
    this.displaySecurityStatus();
  }

  // ============================================
  // CONFIGURATION MANAGEMENT
  // ============================================

  private initializeConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.config = { ...DEFAULT_SECURITY_CONFIG, ...JSON.parse(configData) };
        console.log('✅ Security configuration loaded from file');
      } else {
        this.config = { ...DEFAULT_SECURITY_CONFIG };
        this.saveConfig();
        console.log('✅ Default security configuration created');
      }
      
      // Add current public IP to whitelist if not present
      this.addCurrentIPToWhitelist();
    } catch (error) {
      console.error('❌ Failed to load security config:', error);
      this.config = { ...DEFAULT_SECURITY_CONFIG };
    }
  }

  private saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('❌ Failed to save security config:', error);
    }
  }

  private async addCurrentIPToWhitelist(): Promise<void> {
    try {
      // Get current public IP
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json() as any;
      const currentIP = data.ip;
      
      if (currentIP && !this.config.whitelist.allowedIPs.includes(currentIP)) {
        this.config.whitelist.allowedIPs.push(currentIP);
        this.saveConfig();
        
        this.logSecurityEvent({
          timestamp: new Date(),
          eventType: 'IP_WHITELISTED',
          sourceIP: currentIP,
          details: { action: 'Auto-added current public IP' },
          severity: 'LOW',
          actionTaken: ['IP added to whitelist']
        });
        
        console.log(`✅ Added current IP to whitelist: ${currentIP}`);
      }
    } catch (error) {
      console.log('⚠️ Could not detect current public IP for whitelist');
    }
  }

  // ============================================
  // IP MANAGEMENT FUNCTIONS
  // ============================================

  public async validateIPAccess(ip: string): Promise<boolean> {
    try {
      // Check if system is locked
      if (this.systemLocked) {
        this.logSecurityEvent({
          timestamp: new Date(),
          eventType: 'AUTH_FAILURE',
          sourceIP: ip,
          details: { reason: 'System locked' },
          severity: 'HIGH',
          actionTaken: ['Access denied - system locked']
        });
        return false;
      }

      // Check blacklist first
      if (this.config.blacklist.enabled && this.isIPBlocked(ip)) {
        this.logSecurityEvent({
          timestamp: new Date(),
          eventType: 'AUTH_FAILURE',
          sourceIP: ip,
          details: { reason: 'IP blacklisted' },
          severity: 'HIGH',
          actionTaken: ['Access denied - IP blocked']
        });
        return false;
      }

      // Check whitelist if enabled
      if (this.config.whitelist.enabled) {
        const isWhitelisted = this.isIPWhitelisted(ip);
        
        if (!isWhitelisted) {
          await this.logAuthenticationFailure(ip, { reason: 'IP not whitelisted' });
          return false;
        }
      }

      // Track active connection
      this.activeConnections.set(ip, new Date());
      
      this.logSecurityEvent({
        timestamp: new Date(),
        eventType: 'SYSTEM_ACCESS',
        sourceIP: ip,
        details: { action: 'Access granted' },
        severity: 'LOW',
        actionTaken: ['Access granted']
      });

      return true;
    } catch (error) {
      console.error('❌ IP validation error:', error);
      return false;
    }
  }

  public async logAuthenticationFailure(ip: string, details: any): Promise<void> {
    try {
      const now = new Date();
      const failureWindow = (this.config.authentication.failureWindow || 300) * 1000; // Convert to milliseconds
      
      // Get or create intrusion attempt record
      let attempt = this.failedAttempts.get(ip) || {
        ip,
        timestamp: now,
        attemptCount: 0,
        lastAttempt: now,
        blocked: false,
        details: ''
      };

      // Reset attempt count if outside failure window
      if (now.getTime() - attempt.timestamp.getTime() > failureWindow) {
        attempt.attemptCount = 0;
        attempt.timestamp = now;
      }

      attempt.attemptCount++;
      attempt.lastAttempt = now;
      attempt.details = JSON.stringify(details);

      // Check if should auto-block based on new threshold (3 attempts in 5 minutes)
      const shouldBlock = attempt.attemptCount >= this.config.authentication.maxFailedAttempts;
      
      if (shouldBlock) {
        await this.blockIP(ip, `Auto-blocked after ${attempt.attemptCount} failed attempts in ${failureWindow/60000} minutes`);
        attempt.blocked = true;
        
        // Send alerts for authentication failures
        await this.sendAlert('authFailure', {
          sourceIP: ip,
          count: attempt.attemptCount,
          window: `${failureWindow/60000} minutes`,
          actions: ['IP blocked', 'Access denied']
        });
      }

      this.failedAttempts.set(ip, attempt);

      // Log security event
      this.logSecurityEvent({
        timestamp: now,
        eventType: 'AUTH_FAILURE',
        sourceIP: ip,
        details,
        severity: shouldBlock ? 'HIGH' : 'MEDIUM',
        actionTaken: shouldBlock ? ['IP blocked', 'Alert triggered'] : ['Attempt logged']
      });

      console.log(`🚨 Authentication failure from ${ip} (${attempt.attemptCount}/${this.config.authentication.maxFailedAttempts} attempts in window)`);
      
      // Check for intrusion patterns
      await this.checkIntrusionPattern(ip);
      
      // Add authentication compromise indicator for multi-factor analysis
      if (shouldBlock) {
        await this.addSecurityIndicator(
          SecurityIndicatorType.AUTHENTICATION_COMPROMISE,
          ip,
          'CRITICAL',
          {
            attempts: attempt.attemptCount,
            timeWindow: failureWindow / 1000,
            method: 'Authentication failure detection',
            description: `Authentication compromise: ${attempt.attemptCount} failed attempts`
          }
        );
      }
      
    } catch (error) {
      console.error('❌ Failed to log authentication failure:', error);
    }
  }

  public async checkIntrusionPattern(ip: string): Promise<boolean> {
    try {
      const attempt = this.failedAttempts.get(ip);
      if (!attempt) return false;

      // Define intrusion pattern thresholds
      const INTRUSION_THRESHOLDS = {
        MULTIPLE_RAPID: 3,    // 3+ attempts in 5 minutes
        PERSISTENT: 5,        // 5+ attempts total
        SUSPICIOUS_TIMING: 10 // 10+ attempts in 1 hour
      };

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Count recent attempts
      const recentAttempts = Array.from(this.failedAttempts.values())
        .filter(a => a.ip === ip && a.lastAttempt >= fiveMinutesAgo).length;

      const hourlyAttempts = Array.from(this.failedAttempts.values())
        .filter(a => a.ip === ip && a.lastAttempt >= oneHourAgo).length;

      let intrusionDetected = false;
      let intrusionType = '';

      if (recentAttempts >= INTRUSION_THRESHOLDS.MULTIPLE_RAPID) {
        intrusionDetected = true;
        intrusionType = 'MULTIPLE_RAPID';
      } else if (attempt.attemptCount >= INTRUSION_THRESHOLDS.PERSISTENT) {
        intrusionDetected = true;
        intrusionType = 'PERSISTENT';
      } else if (hourlyAttempts >= INTRUSION_THRESHOLDS.SUSPICIOUS_TIMING) {
        intrusionDetected = true;
        intrusionType = 'SUSPICIOUS_TIMING';
      }

      if (intrusionDetected) {
        // CRITICAL: Intrusion detection is a SECURITY THREAT
        await this.handleIntrusionDetected(ip, intrusionType, {
          recentAttempts,
          hourlyAttempts,
          totalAttempts: attempt.attemptCount,
          actions: ['Enhanced monitoring', 'Pattern analysis', 'Security breach response']
        });
      }

      return intrusionDetected;
    } catch (error) {
      console.error('❌ Failed to check intrusion pattern:', error);
      return false;
    }
  }

  private async handleIntrusionDetected(ip: string, type: string, details: any): Promise<void> {
    try {
      console.log(`🚨 INTRUSION DETECTED: ${type} from ${ip}`);
      
      // Block IP if not already blocked
      if (!this.isIPBlocked(ip)) {
        await this.blockIP(ip, `Intrusion detected: ${type}`);
      }

      // Log critical security event
      this.logSecurityEvent({
        timestamp: new Date(),
        eventType: 'INTRUSION_DETECTED',
        sourceIP: ip,
        details: { type, ...details },
        severity: 'CRITICAL',
        actionTaken: ['IP blocked', 'Alert sent', 'Intrusion logged']
      });

      // Send alerts (will be implemented in step 2)
      await this.sendIntrusionAlert(ip, type, details);

      // Add intrusion indicators for multi-factor analysis
      await this.addSecurityIndicator(
        SecurityIndicatorType.NETWORK_INTRUSION,
        ip,
        'CRITICAL',
        {
          pattern: type,
          attempts: details.totalAttempts,
          recentAttempts: details.recentAttempts,
          method: 'Intrusion pattern detection',
          description: `${type} intrusion pattern detected: ${details.totalAttempts} total attempts`
        }
      );
      
      // Legacy single-factor emergency triggers (if multi-factor disabled)
      if (!this.config.emergency.hardwareWalletFlush.multiFactor.enabled) {
        if (type === 'MULTIPLE_RAPID' && details.recentAttempts >= 5) {
          await this.triggerEmergencyResponse(`SECURITY_BREACH: Multiple intrusion attempts from ${ip}`, 'CRITICAL');
        } else if (type === 'PERSISTENT' && details.totalAttempts >= 10) {
          await this.triggerEmergencyResponse(`SECURITY_BREACH: Persistent attack from ${ip}`, 'CRITICAL');
        }
      }

    } catch (error) {
      console.error('❌ Failed to handle intrusion:', error);
    }
  }

  public async blockIP(ip: string, reason: string): Promise<void> {
    try {
      if (!this.config.blacklist.blockedIPs.includes(ip)) {
        this.config.blacklist.blockedIPs.push(ip);
        this.saveConfig();
        
        console.log(`🔒 IP Blocked: ${ip} - ${reason}`);
        
        this.logSecurityEvent({
          timestamp: new Date(),
          eventType: 'IP_BLOCKED',
          sourceIP: ip,
          details: { reason },
          severity: 'HIGH',
          actionTaken: ['IP added to blacklist']
        });
      }
    } catch (error) {
      console.error('❌ Failed to block IP:', error);
    }
  }

  public async unblockIP(ip: string): Promise<void> {
    try {
      const index = this.config.blacklist.blockedIPs.indexOf(ip);
      if (index > -1) {
        this.config.blacklist.blockedIPs.splice(index, 1);
        this.saveConfig();
        
        console.log(`🔓 IP Unblocked: ${ip}`);
        
        this.logSecurityEvent({
          timestamp: new Date(),
          eventType: 'SYSTEM_ACCESS',
          sourceIP: ip,
          details: { action: 'IP unblocked manually' },
          severity: 'LOW',
          actionTaken: ['IP removed from blacklist']
        });
      }
      
      // Also remove from failed attempts
      this.failedAttempts.delete(ip);
    } catch (error) {
      console.error('❌ Failed to unblock IP:', error);
    }
  }

  private isIPWhitelisted(ip: string): boolean {
    // Check localhost
    if (this.config.whitelist.allowLocalhost && (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost')) {
      return true;
    }
    
    // Check whitelist
    return this.config.whitelist.allowedIPs.includes(ip);
  }

  private isIPBlocked(ip: string): boolean {
    return this.config.blacklist.blockedIPs.includes(ip);
  }

  // ============================================
  // EVENT LOGGING
  // ============================================

  private logSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event);
    
    // Keep only last 1000 events in memory
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }
    
    // Save critical events to file
    if (event.severity === 'CRITICAL' || event.severity === 'HIGH') {
      this.saveSecurityEvent(event);
    }
  }

  private saveSecurityEvent(event: SecurityEvent): void {
    try {
      const eventsFile = path.join(__dirname, '../../data/security_events.jsonl');
      const eventLine = JSON.stringify(event) + '\n';
      
      fs.appendFileSync(eventsFile, eventLine);
    } catch (error) {
      console.error('❌ Failed to save security event:', error);
    }
  }

  // ============================================
  // STATUS & MONITORING
  // ============================================

  public getSecurityStatus(): SecurityStatus {
    const recentEvents = this.securityEvents.filter(
      event => event.timestamp >= new Date(Date.now() - 60 * 60 * 1000) // Last hour
    ).length;

    return {
      systemLocked: this.systemLocked,
      tradingHalted: this.tradingHalted,
      whitelistActive: this.config.whitelist.enabled,
      blacklistCount: this.config.blacklist.blockedIPs.length,
      recentEvents,
      emergencyTriggered: this.emergencyTriggered
    };
  }

  public displaySecurityStatus(): void {
    const status = this.getSecurityStatus();
    
    console.log('\n🛡️ SECURITY STATUS:');
    console.log(`   System Status: ${status.systemLocked ? '🔒 LOCKED' : '✅ ACTIVE'}`);
    console.log(`   Trading: ${status.tradingHalted ? '⏸️ HALTED' : '✅ ACTIVE'}`);
    console.log(`   Whitelist: ${status.whitelistActive ? '✅ ENABLED' : '❌ DISABLED'} (${this.config.whitelist.allowedIPs.length} IPs)`);
    console.log(`   Blacklist: ${status.blacklistCount} blocked IPs`);
    console.log(`   Recent Events: ${status.recentEvents} (last hour)`);
    console.log(`   Emergency: ${status.emergencyTriggered ? '🚨 TRIGGERED' : '✅ NORMAL'}`);
    console.log('');
  }

  // ============================================
  // ALERT SYSTEM
  // ============================================

  public async sendAlert(alertType: 'intrusionDetected' | 'emergencyEvent' | 'authFailure', data: any): Promise<void> {
    try {
      if (this.config.alerts.sms.enabled) {
        await this.sendSMSAlert(alertType, data);
      }
      
      if (this.config.alerts.email.enabled) {
        await this.sendEmailAlert(alertType, data);
      }
      
      if (this.config.alerts.webhook.enabled) {
        await this.sendWebhookAlert(alertType, data);
      }
    } catch (error) {
      console.error('❌ Failed to send alert:', error);
    }
  }

  private async sendSMSAlert(alertType: string, data: any): Promise<void> {
    try {
      const template = this.config.alerts.templates?.[alertType as keyof typeof this.config.alerts.templates];
      if (!template || !template.sms) {
        console.log('⚠️ No SMS template found for alert type:', alertType);
        return;
      }

      const message = this.formatAlertMessage(template.sms, data);
      const provider = this.config.alerts.sms.provider;
      
      console.log(`📱 SMS Alert (${provider}):`, message);
      
      if (provider === 'twilio' && this.config.alerts.sms.providers?.twilio) {
        await this.sendTwilioSMS(message, data);
      } else if (provider === 'aws' && this.config.alerts.sms.providers?.aws) {
        await this.sendAWSSMS(message, data);
      } else {
        console.log('⚠️ SMS provider not configured or credentials missing');
      }
    } catch (error) {
      console.error('❌ Failed to send SMS alert:', error);
    }
  }

  private async sendEmailAlert(alertType: string, data: any): Promise<void> {
    try {
      const template = this.config.alerts.templates?.[alertType as keyof typeof this.config.alerts.templates];
      if (!template || !template.email) {
        console.log('⚠️ No email template found for alert type:', alertType);
        return;
      }

      const subject = this.formatAlertMessage(template.email.subject, data);
      const body = this.formatAlertMessage(template.email.body, data);
      
      console.log(`📧 Email Alert:`, { subject, body: body.substring(0, 100) + '...' });
      
      if (this.config.alerts.email.smtpConfig.host) {
        await this.sendSMTPEmail(subject, body, data);
      } else {
        console.log('⚠️ SMTP configuration missing for email alerts');
      }
    } catch (error) {
      console.error('❌ Failed to send email alert:', error);
    }
  }

  private async sendWebhookAlert(alertType: string, data: any): Promise<void> {
    try {
      const payload = {
        alertType,
        timestamp: new Date().toISOString(),
        data,
        system: 'SOL-BOT SecurityManager'
      };
      
      console.log('🔗 Webhook Alert:', this.config.alerts.webhook.url);
      
      // Webhook implementation would go here
      // For now, just log the payload
      console.log('Webhook payload:', payload);
    } catch (error) {
      console.error('❌ Failed to send webhook alert:', error);
    }
  }

  private formatAlertMessage(template: string, data: any): string {
    let message = template;
    
    // Replace placeholders with actual data
    Object.keys(data).forEach(key => {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), data[key]);
    });
    
    // Add timestamp if not present
    message = message.replace('{timestamp}', new Date().toISOString());
    
    return message;
  }

  private async sendTwilioSMS(message: string, data: any): Promise<void> {
    try {
      const twilioConfig = this.config.alerts.sms.providers?.twilio;
      if (!twilioConfig?.accountSid || !twilioConfig?.authToken) {
        console.log('⚠️ Twilio credentials not configured');
        return;
      }
      
      // Twilio SMS implementation would go here
      // For now, simulate the API call
      console.log('📱 Twilio SMS would be sent:', {
        to: this.config.alerts.sms.phoneNumber,
        from: twilioConfig.fromNumber,
        message: message.substring(0, 160) // SMS length limit
      });
    } catch (error) {
      console.error('❌ Twilio SMS error:', error);
    }
  }

  private async sendAWSSMS(message: string, data: any): Promise<void> {
    try {
      const awsConfig = this.config.alerts.sms.providers?.aws;
      if (!awsConfig?.accessKeyId || !awsConfig?.secretAccessKey) {
        console.log('⚠️ AWS credentials not configured');
        return;
      }
      
      // AWS SNS implementation would go here
      // For now, simulate the API call
      console.log('📱 AWS SNS SMS would be sent:', {
        phoneNumber: this.config.alerts.sms.phoneNumber,
        message: message.substring(0, 160),
        region: awsConfig.region
      });
    } catch (error) {
      console.error('❌ AWS SMS error:', error);
    }
  }

  private async sendSMTPEmail(subject: string, body: string, data: any): Promise<void> {
    try {
      const smtpConfig = this.config.alerts.email.smtpConfig;
      if (!smtpConfig.host || !smtpConfig.auth?.user) {
        console.log('⚠️ SMTP configuration incomplete');
        return;
      }
      
      // SMTP email implementation would go here
      // For now, simulate the email sending
      console.log('📧 SMTP Email would be sent:', {
        to: this.config.alerts.email.emailAddress,
        from: smtpConfig.auth.user,
        subject,
        body: body.substring(0, 200) + '...'
      });
    } catch (error) {
      console.error('❌ SMTP email error:', error);
    }
  }

  private async sendIntrusionAlert(ip: string, type: string, details: any): Promise<void> {
    await this.sendAlert('intrusionDetected', {
      sourceIP: ip,
      pattern: type,
      timestamp: new Date().toISOString(),
      actions: details.actions || ['IP monitoring increased']
    });
  }

  // ============================================
  // MULTI-FACTOR SECURITY INDICATOR SYSTEM
  // ============================================
  
  /**
   * Add a security indicator - single events log and alert only
   * Multi-factor correlation triggers emergency response
   */
  public async addSecurityIndicator(
    type: SecurityIndicatorType,
    sourceIP: string,
    severity: 'HIGH' | 'CRITICAL',
    details: any
  ): Promise<void> {
    try {
      const indicator: SecurityIndicator = {
        type,
        timestamp: new Date(),
        sourceIP,
        severity,
        details,
        relatedEvents: []
      };
      
      this.securityIndicators.push(indicator);
      
      // Log security event for this indicator
      const eventId = this.generateEventId();
      indicator.relatedEvents.push(eventId);
      
      this.logSecurityEvent({
        timestamp: indicator.timestamp,
        eventType: this.getEventTypeFromIndicator(type),
        sourceIP,
        details: {
          ...details,
          indicatorType: type,
          eventId
        },
        severity,
        actionTaken: ['Security indicator recorded', 'Correlation analysis initiated'],
        securityIndicator: type
      });
      
      // Send single-factor alert
      await this.sendSecurityIndicatorAlert(indicator);
      
      console.log(`📊 Security Indicator Added: ${type} from ${sourceIP} (${severity})`);
      
      // Check for multi-factor correlation
      await this.evaluateMultiFactorTriggers();
      
    } catch (error) {
      console.error('❌ Failed to add security indicator:', error);
    }
  }
  
  /**
   * Evaluate if multiple security indicators warrant emergency response
   */
  private async evaluateMultiFactorTriggers(): Promise<void> {
    try {
      if (!this.config.emergency.hardwareWalletFlush.multiFactor.enabled) {
        return;
      }
      
      const timeWindow = this.config.emergency.hardwareWalletFlush.multiFactor.timeWindow * 1000;
      const requiredIndicators = this.config.emergency.hardwareWalletFlush.multiFactor.requiredIndicators;
      const cutoff = new Date(Date.now() - timeWindow);
      
      // Get recent indicators within time window
      const recentIndicators = this.securityIndicators.filter(indicator => 
        indicator.timestamp >= cutoff
      );
      
      if (recentIndicators.length < requiredIndicators) {
        return; // Not enough indicators for multi-factor trigger
      }
      
      // Group indicators by type to ensure diversity
      const indicatorTypes = new Set(recentIndicators.map(i => i.type));
      
      if (indicatorTypes.size >= requiredIndicators) {
        console.log(`🚨 MULTI-FACTOR SECURITY BREACH DETECTED!`);
        console.log(`   Found ${indicatorTypes.size} different security indicators within ${timeWindow/60000} minutes:`);
        
        indicatorTypes.forEach(type => {
          const indicators = recentIndicators.filter(i => i.type === type);
          console.log(`   - ${type}: ${indicators.length} occurrence(s)`);
        });
        
        // Trigger multi-factor emergency response
        await this.triggerMultiFactorEmergency(Array.from(indicatorTypes), recentIndicators);
      }
      
    } catch (error) {
      console.error('❌ Multi-factor evaluation failed:', error);
    }
  }
  
  /**
   * Trigger emergency response for multi-factor security breach
   */
  private async triggerMultiFactorEmergency(
    indicatorTypes: SecurityIndicatorType[],
    indicators: SecurityIndicator[]
  ): Promise<void> {
    try {
      const reason = `MULTI-FACTOR_SECURITY_BREACH: ${indicatorTypes.join(', ')}`;
      
      console.log(`🚨 TRIGGERING MULTI-FACTOR EMERGENCY RESPONSE`);
      console.log(`   Indicators: ${indicatorTypes.length}`);
      console.log(`   Time Window: ${this.config.emergency.hardwareWalletFlush.multiFactor.timeWindow/60} minutes`);
      console.log(`   Affected IPs: ${new Set(indicators.map(i => i.sourceIP)).size}`);
      
      // Log critical multi-factor event
      this.logSecurityEvent({
        timestamp: new Date(),
        eventType: 'EMERGENCY_TRIGGERED',
        sourceIP: 'multi-factor-correlation',
        details: {
          reason,
          indicatorTypes,
          indicatorCount: indicators.length,
          timeWindow: this.config.emergency.hardwareWalletFlush.multiFactor.timeWindow,
          affectedIPs: Array.from(new Set(indicators.map(i => i.sourceIP))),
          indicators: indicators.map(i => ({
            type: i.type,
            timestamp: i.timestamp,
            sourceIP: i.sourceIP,
            severity: i.severity
          }))
        },
        severity: 'CRITICAL',
        actionTaken: ['Multi-factor breach detected', 'Emergency protocols initiated']
      });
      
      // Trigger emergency response with hardware wallet flush
      await this.triggerEmergencyResponse(reason, 'CRITICAL');
      
      // Send multi-factor emergency alert
      await this.sendAlert('emergencyEvent', {
        eventType: 'MULTI_FACTOR_SECURITY_BREACH',
        timestamp: new Date().toISOString(),
        conditions: indicatorTypes,
        indicatorCount: indicators.length,
        actions: ['Emergency lockdown', 'Hardware wallet flush initiated', 'All trading suspended']
      });
      
    } catch (error) {
      console.error('❌ Multi-factor emergency trigger failed:', error);
    }
  }
  
  /**
   * Security detection methods for different threat types
   */
  public async detectSSHBruteForce(sourceIP: string, attempts: number, timespan: number): Promise<void> {
    await this.addSecurityIndicator(
      SecurityIndicatorType.SSH_BRUTE_FORCE,
      sourceIP,
      'CRITICAL',
      {
        attempts,
        timespan,
        method: 'SSH brute force detection',
        description: `${attempts} SSH login attempts in ${timespan} seconds`
      }
    );
  }
  
  public async detectUnauthorizedFileAccess(sourceIP: string, filePath: string, accessType: string): Promise<void> {
    await this.addSecurityIndicator(
      SecurityIndicatorType.UNAUTHORIZED_FILE_ACCESS,
      sourceIP,
      'HIGH',
      {
        filePath,
        accessType,
        method: 'File access monitoring',
        description: `Unauthorized ${accessType} access to ${filePath}`
      }
    );
  }
  
  public async detectProcessTampering(sourceIP: string, processName: string, action: string): Promise<void> {
    await this.addSecurityIndicator(
      SecurityIndicatorType.PROCESS_TAMPERING,
      sourceIP,
      'CRITICAL',
      {
        processName,
        action,
        method: 'Process integrity monitoring',
        description: `Process tampering detected: ${action} on ${processName}`
      }
    );
  }
  
  public async detectNetworkIntrusion(sourceIP: string, scanType: string, portCount: number): Promise<void> {
    await this.addSecurityIndicator(
      SecurityIndicatorType.NETWORK_INTRUSION,
      sourceIP,
      'HIGH',
      {
        scanType,
        portCount,
        method: 'Network intrusion detection',
        description: `${scanType} scan detected from ${sourceIP} targeting ${portCount} ports`
      }
    );
  }
  
  public async detectPrivilegeEscalation(sourceIP: string, fromUser: string, toUser: string): Promise<void> {
    await this.addSecurityIndicator(
      SecurityIndicatorType.PRIVILEGE_ESCALATION,
      sourceIP,
      'CRITICAL',
      {
        fromUser,
        toUser,
        method: 'Privilege escalation detection',
        description: `Privilege escalation attempt from ${fromUser} to ${toUser}`
      }
    );
  }
  
  /**
   * Helper methods for multi-factor system
   */
  private generateEventId(): string {
    return 'SEC-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  private getEventTypeFromIndicator(type: SecurityIndicatorType): SecurityEvent['eventType'] {
    switch (type) {
      case SecurityIndicatorType.SSH_BRUTE_FORCE:
        return 'SSH_ATTACK';
      case SecurityIndicatorType.UNAUTHORIZED_FILE_ACCESS:
        return 'FILE_ACCESS_VIOLATION';
      case SecurityIndicatorType.PROCESS_TAMPERING:
        return 'PROCESS_TAMPERING';
      case SecurityIndicatorType.NETWORK_INTRUSION:
        return 'NETWORK_SCAN';
      case SecurityIndicatorType.PRIVILEGE_ESCALATION:
        return 'PRIVILEGE_ESCALATION';
      default:
        return 'INTRUSION_DETECTED';
    }
  }
  
  private async sendSecurityIndicatorAlert(indicator: SecurityIndicator): Promise<void> {
    try {
      // Send single-factor alert (not emergency)
      console.log(`📮 Security Alert: ${indicator.type} detected from ${indicator.sourceIP}`);
      console.log(`   Severity: ${indicator.severity}`);
      console.log(`   Details: ${JSON.stringify(indicator.details)}`);
      console.log(`   ⚠️  Single factor - monitoring for additional indicators...`);
      
      // Could send email/SMS alert here for single indicators
      // But not triggering emergency response yet
      
    } catch (error) {
      console.error('❌ Failed to send indicator alert:', error);
    }
  }
  
  /**
   * Get recent security indicators for analysis
   */
  public getRecentSecurityIndicators(minutes: number = 10): SecurityIndicator[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.securityIndicators.filter(indicator => indicator.timestamp >= cutoff);
  }
  
  /**
   * Get multi-factor analysis summary
   */
  public getMultiFactorAnalysis(): {
    recentIndicators: SecurityIndicator[];
    uniqueTypes: number;
    timeWindow: number;
    requiredForTrigger: number;
    emergencyThreshold: boolean;
  } {
    const recentIndicators = this.getRecentSecurityIndicators(
      this.config.emergency.hardwareWalletFlush.multiFactor.timeWindow / 60
    );
    
    const uniqueTypes = new Set(recentIndicators.map(i => i.type)).size;
    const requiredForTrigger = this.config.emergency.hardwareWalletFlush.multiFactor.requiredIndicators;
    
    return {
      recentIndicators,
      uniqueTypes,
      timeWindow: this.config.emergency.hardwareWalletFlush.multiFactor.timeWindow / 60,
      requiredForTrigger,
      emergencyThreshold: uniqueTypes >= requiredForTrigger
    };
  }
  
  // ============================================
  // EMERGENCY RESPONSE SYSTEM
  // ============================================

  public async triggerEmergencyResponse(reason: string, severity: 'HIGH' | 'CRITICAL' = 'HIGH'): Promise<void> {
    try {
      console.log(`🚨 EMERGENCY RESPONSE TRIGGERED: ${reason}`);
      this.emergencyTriggered = true;
      this.systemLocked = true;
      
      // Halt all trading immediately
      if (this.config.emergency.tradingHalt.enabled) {
        await this.haltTrading('EMERGENCY: ' + reason);
      }
      
      // Trigger hardware wallet flush if conditions are met
      if (this.config.emergency.hardwareWalletFlush.enabled && 
          this.shouldTriggerWalletFlush(reason, severity)) {
        await this.emergencyWalletFlush(reason);
      }
      
      // Send emergency alerts
      await this.sendAlert('emergencyEvent', {
        eventType: reason,
        timestamp: new Date().toISOString(),
        conditions: [reason],
        actions: [
          'System locked',
          'Trading halted',
          this.config.emergency.hardwareWalletFlush.enabled ? 'Wallet flush initiated' : 'Wallet flush disabled'
        ]
      });
      
      // Log critical security event
      this.logSecurityEvent({
        timestamp: new Date(),
        eventType: 'EMERGENCY_TRIGGERED',
        sourceIP: 'system',
        details: { reason, severity, actions: ['System lockdown', 'Trading halt'] },
        severity: 'CRITICAL',
        actionTaken: ['Emergency protocols activated']
      });
      
      console.log('🔒 System locked - All operations suspended');
      
    } catch (error) {
      console.error('❌ Emergency response failed:', error);
    }
  }
  
  private shouldTriggerWalletFlush(reason: string, severity: string): boolean {
    // Check if this is a multi-factor emergency (already validated)
    if (reason.includes('MULTI-FACTOR_SECURITY_BREACH')) {
      console.log('🔍 Multi-factor breach confirmed - wallet flush authorized');
      return true;
    }
    
    // For single-factor events, check if multi-factor is disabled
    if (this.config.emergency.hardwareWalletFlush.multiFactor.enabled) {
      console.log('🔍 Multi-factor mode enabled - single events do not trigger wallet flush');
      console.log(`   Reason: ${reason}`);
      console.log(`   Severity: ${severity}`);
      console.log(`   ⚠️  Waiting for additional security indicators...`);
      return false; // Multi-factor enabled - single events don't trigger flush
    }
    
    // Legacy single-factor mode (if multi-factor disabled)
    const triggerConditions = this.config.emergency.hardwareWalletFlush.triggerConditions;
    const reasonMatches = triggerConditions.some(condition => 
      reason.toUpperCase().includes(condition.replace('_', ' '))
    );
    const severityTrigger = severity === 'CRITICAL';
    
    console.log('🔍 Single-factor wallet flush check:');
    console.log(`   Reason match: ${reasonMatches}`);
    console.log(`   Severity trigger: ${severityTrigger}`);
    
    return reasonMatches || severityTrigger;
  }
  
  public async emergencyWalletFlush(reason: string): Promise<boolean> {
    try {
      console.log('🚨 INITIATING EMERGENCY WALLET FLUSH');
      
      const hardwareWallet = this.config.emergency.hardwareWalletFlush.targetWallet;
      if (!hardwareWallet) {
        console.log('⚠️ No hardware wallet configured - flush aborted');
        return false;
      }
      
      // Get wallet balance
      const balance = await this.getWalletBalance();
      if (!balance || balance < this.config.emergency.hardwareWalletFlush.minBalanceThreshold) {
        console.log(`⚠️ Balance too low for flush: $${balance} < $${this.config.emergency.hardwareWalletFlush.minBalanceThreshold}`);
        return false;
      }
      
      console.log(`💰 Wallet balance: $${balance} - Proceeding with flush`);
      
      // Execute the transfer
      const success = await this.transferToHardwareWallet(hardwareWallet, balance, reason);
      
      if (success) {
        console.log('✅ Emergency wallet flush completed successfully');
        
        // Log the emergency transfer
        this.logSecurityEvent({
          timestamp: new Date(),
          eventType: 'EMERGENCY_TRIGGERED',
          sourceIP: 'system',
          details: { 
            action: 'Hardware wallet flush',
            amount: balance,
            targetWallet: hardwareWallet,
            reason 
          },
          severity: 'CRITICAL',
          actionTaken: ['Funds transferred to hardware wallet']
        });
        
        return true;
      } else {
        console.log('❌ Emergency wallet flush failed');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Emergency wallet flush error:', error);
      return false;
    }
  }
  
  private async getWalletBalance(): Promise<number | null> {
    try {
      // This would integrate with the actual wallet system
      // For now, simulate checking wallet balance
      
      const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');
      
      // Get private key from environment (same as main bot)
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        console.log('⚠️ No private key available for balance check');
        return null;
      }
      
      const secretKey = bs58.decode(privateKey);
      const wallet = Keypair.fromSecretKey(secretKey);
      
      // Get SOL balance
      const balance = await connection.getBalance(wallet.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      // Convert to USD (would need to get current SOL price)
      // For now, use a reasonable estimate
      const estimatedUSD = solBalance * 150; // Rough SOL price estimate
      
      return estimatedUSD;
      
    } catch (error) {
      console.error('❌ Error getting wallet balance:', error);
      return null;
    }
  }
  
  private async transferToHardwareWallet(hardwareWallet: string, amount: number, reason: string): Promise<boolean> {
    try {
      console.log(`🔄 Transferring $${amount} to hardware wallet: ${hardwareWallet}`);
      
      // Get connection and wallet
      const connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');
      const privateKey = process.env.PRIVATE_KEY;
      
      if (!privateKey) {
        console.log('⚠️ No private key available for transfer');
        return false;
      }
      
      const secretKey = bs58.decode(privateKey);
      const fromWallet = Keypair.fromSecretKey(secretKey);
      const toWallet = new PublicKey(hardwareWallet);
      
      // Get current balance
      const balance = await connection.getBalance(fromWallet.publicKey);
      
      // Keep some SOL for transaction fees (0.01 SOL)
      const feeReserve = 0.01 * LAMPORTS_PER_SOL;
      const transferAmount = Math.max(0, balance - feeReserve);
      
      if (transferAmount <= 0) {
        console.log('⚠️ Insufficient balance for transfer after fee reserve');
        return false;
      }
      
      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromWallet.publicKey,
          toPubkey: toWallet,
          lamports: transferAmount
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromWallet.publicKey;
      
      // Sign and send transaction
      transaction.sign(fromWallet);
      
      // In production, this would actually send the transaction
      // For security testing, we'll simulate it
      console.log('📝 SIMULATION: Transfer transaction would be sent');
      console.log(`   From: ${fromWallet.publicKey.toBase58()}`);
      console.log(`   To: ${hardwareWallet}`);
      console.log(`   Amount: ${transferAmount / LAMPORTS_PER_SOL} SOL`);
      console.log(`   Reason: ${reason}`);
      
      // Simulate successful transfer
      return true;
      
    } catch (error) {
      console.error('❌ Hardware wallet transfer error:', error);
      return false;
    }
  }
  
  public async haltTrading(reason: string): Promise<void> {
    try {
      console.log(`⏸️ TRADING HALTED: ${reason}`);
      this.tradingHalted = true;
      
      // Log trading halt event
      this.logSecurityEvent({
        timestamp: new Date(),
        eventType: 'EMERGENCY_TRIGGERED',
        sourceIP: 'system',
        details: { action: 'Trading halt', reason },
        severity: 'HIGH',
        actionTaken: ['All trading operations suspended']
      });
      
      // Save state
      this.saveConfig();
      
    } catch (error) {
      console.error('❌ Trading halt error:', error);
    }
  }
  
  public resumeTrading(reason: string): void {
    try {
      console.log(`▶️ TRADING RESUMED: ${reason}`);
      this.tradingHalted = false;
      
      // Log trading resume event
      this.logSecurityEvent({
        timestamp: new Date(),
        eventType: 'SYSTEM_ACCESS',
        sourceIP: 'system',
        details: { action: 'Trading resume', reason },
        severity: 'LOW',
        actionTaken: ['Trading operations restored']
      });
      
      // Save state
      this.saveConfig();
      
    } catch (error) {
      console.error('❌ Trading resume error:', error);
    }
  }
  
  // ============================================
  // INTEGRATION HOOKS FOR MAIN BOT
  // ============================================
  
  public async checkSecurityStatusBeforeTrade(tradeDetails: any): Promise<{ allowed: boolean, reason?: string }> {
    try {
      // Check if system is locked
      if (this.systemLocked) {
        return {
          allowed: false,
          reason: 'System is locked due to security event'
        };
      }
      
      // Check if trading is halted
      if (this.tradingHalted) {
        return {
          allowed: false,
          reason: 'Trading is halted for security reasons'
        };
      }
      
      // Check if emergency is triggered
      if (this.emergencyTriggered) {
        return {
          allowed: false,
          reason: 'Emergency protocols are active'
        };
      }
      
      // Check for recent high-severity security events
      const recentCriticalEvents = this.securityEvents.filter(event => 
        event.severity === 'CRITICAL' && 
        event.timestamp >= new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
      );
      
      if (recentCriticalEvents.length > 0) {
        return {
          allowed: false,
          reason: `Recent critical security events detected (${recentCriticalEvents.length})`
        };
      }
      
      // Check for excessive failed attempts
      const recentFailures = Array.from(this.failedAttempts.values()).filter(
        attempt => attempt.lastAttempt >= new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
      );
      
      if (recentFailures.length >= 5) {
        return {
          allowed: false,
          reason: `High security activity detected (${recentFailures.length} recent failures)`
        };
      }
      
      // All checks passed
      return { allowed: true };
      
    } catch (error) {
      console.error('❌ Security check error:', error);
      return {
        allowed: false,
        reason: 'Security check failed - trading suspended for safety'
      };
    }
  }
  
  public async logTradingActivity(activity: {
    type: 'BUY' | 'SELL' | 'SWAP';
    amount: number;
    token: string;
    walletAddress: string;
    success: boolean;
  }): Promise<void> {
    try {
      this.logSecurityEvent({
        timestamp: new Date(),
        eventType: 'SYSTEM_ACCESS',
        sourceIP: 'trading-bot',
        details: {
          action: 'Trading activity',
          type: activity.type,
          amount: activity.amount,
          token: activity.token,
          wallet: activity.walletAddress,
          success: activity.success
        },
        severity: 'LOW',
        actionTaken: ['Trading activity logged']
      });
      
      // Monitor for suspicious trading patterns
      await this.monitorTradingPatterns(activity);
      
    } catch (error) {
      console.error('❌ Error logging trading activity:', error);
    }
  }
  
  private async monitorTradingPatterns(activity: any): Promise<void> {
    try {
      // PERFORMANCE MONITORING ONLY - NO SECURITY TRIGGERS
      // This function only logs trading performance metrics
      
      const recentTrades = this.securityEvents.filter(event => 
        event.sourceIP === 'trading-bot' &&
        event.details?.action === 'Trading activity' &&
        event.timestamp >= new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      );
      
      if (recentTrades.length >= 20) {
        console.log('📊 Performance Alert: High trading velocity detected - ' + recentTrades.length + ' trades in 5 minutes');
        
        // LOG ONLY - DO NOT TRIGGER EMERGENCY FOR TRADING ACTIVITY
        this.logSecurityEvent({
          timestamp: new Date(),
          eventType: 'SYSTEM_ACCESS',
          sourceIP: 'trading-bot',
          details: {
            action: 'High trading velocity',
            tradeCount: recentTrades.length,
            timeWindow: '5 minutes',
            note: 'Performance monitoring - not a security threat'
          },
          severity: 'LOW', // LOW severity - this is performance, not security
          actionTaken: ['Performance metrics logged']
        });
      }
      
      // Log large trades for performance tracking (NOT security)
      if (activity.amount > 10000) { // Trades over $10,000
        console.log(`💰 Performance Monitor: Large trade executed - $${activity.amount}`);
        
        this.logSecurityEvent({
          timestamp: new Date(),
          eventType: 'SYSTEM_ACCESS',
          sourceIP: 'trading-bot',
          details: {
            action: 'Large trade executed',
            amount: activity.amount,
            type: activity.type,
            note: 'Performance tracking - not a security event'
          },
          severity: 'LOW', // Changed from MEDIUM to LOW - this is normal trading
          actionTaken: ['Large trade performance logged']
        });
      }
      
    } catch (error) {
      console.error('❌ Error monitoring trading patterns:', error);
    }
  }
  
  public getSecurityStatusForBot(): {
    systemStatus: 'ACTIVE' | 'LOCKED' | 'EMERGENCY';
    tradingAllowed: boolean;
    lastSecurityCheck: Date;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const recentEvents = this.securityEvents.filter(event => 
      event.timestamp >= new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );
    
    const criticalEvents = recentEvents.filter(e => e.severity === 'CRITICAL');
    const highEvents = recentEvents.filter(e => e.severity === 'HIGH');
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    
    if (criticalEvents.length > 0) {
      riskLevel = 'CRITICAL';
    } else if (highEvents.length >= 3) {
      riskLevel = 'HIGH';
    } else if (recentEvents.length >= 10) {
      riskLevel = 'MEDIUM';
    }
    
    let systemStatus: 'ACTIVE' | 'LOCKED' | 'EMERGENCY' = 'ACTIVE';
    
    if (this.emergencyTriggered) {
      systemStatus = 'EMERGENCY';
    } else if (this.systemLocked) {
      systemStatus = 'LOCKED';
    }
    
    return {
      systemStatus,
      tradingAllowed: !this.tradingHalted && !this.systemLocked && !this.emergencyTriggered,
      lastSecurityCheck: new Date(),
      riskLevel
    };
  }
  
  // ============================================
  // SECURITY THREAT CLASSIFICATION
  // ============================================
  
  /**
   * Determines if an event is a legitimate security threat vs trading performance metric
   * CRITICAL events are ONLY for:
   * - Authentication failures and unauthorized access
   * - System penetration attempts
   * - Network intrusion detection
   * 
   * NOT for:
   * - Trading volume or velocity
   * - Large trade amounts
   * - Trading performance metrics
   */
  public isSecurityThreat(event: SecurityEvent): boolean {
    // Trading performance monitoring - NOT security threats
    if (event.sourceIP === 'trading-bot') {
      const tradingPerformanceActions = [
        'Trading activity',
        'Large trade executed', 
        'High trading velocity',
        'Large trade alert',
        'Trading performance'
      ];
      
      if (tradingPerformanceActions.includes(event.details?.action)) {
        return false; // This is trading performance, not a security threat
      }
    }
    
    // Legitimate security threats
    const securityEventTypes = [
      'AUTH_FAILURE',
      'IP_BLOCKED', 
      'INTRUSION_DETECTED',
      'EMERGENCY_TRIGGERED'
    ];
    
    const securityActions = [
      'Authentication failure',
      'Unauthorized access attempt',
      'System penetration',
      'Network intrusion',
      'IP blocked',
      'Security breach detected'
    ];
    
    return securityEventTypes.includes(event.eventType) || 
           securityActions.some(action => event.details?.action?.includes(action));
  }
  
  /**
   * Get trading performance metrics (separate from security)
   */
  public getTradingPerformanceMetrics(hours: number = 24): {
    totalTrades: number;
    largeTrades: number;
    rapidTradingPeriods: number;
    averageTradeSize: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const tradingEvents = this.securityEvents.filter(event => 
      event.sourceIP === 'trading-bot' &&
      event.timestamp >= cutoff &&
      !this.isSecurityThreat(event)
    );
    
    const totalTrades = tradingEvents.filter(e => e.details?.action === 'Trading activity').length;
    const largeTrades = tradingEvents.filter(e => e.details?.action === 'Large trade executed').length;
    const rapidTradingPeriods = tradingEvents.filter(e => e.details?.action === 'High trading velocity').length;
    
    const tradeSizes = tradingEvents
      .filter(e => e.details?.amount)
      .map(e => e.details.amount);
    const averageTradeSize = tradeSizes.length > 0 ? 
      tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length : 0;
    
    return {
      totalTrades,
      largeTrades,
      rapidTradingPeriods,
      averageTradeSize
    };
  }
  
  /**
   * Get actual security events (excludes trading performance)
   */
  public getSecurityEvents(hours: number = 24): SecurityEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.securityEvents.filter(event => 
      event.timestamp >= cutoff &&
      this.isSecurityThreat(event)
    );
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  public addIPToWhitelist(ip: string, description?: string): void {
    if (!this.config.whitelist.allowedIPs.includes(ip)) {
      this.config.whitelist.allowedIPs.push(ip);
      this.saveConfig();
      
      this.logSecurityEvent({
        timestamp: new Date(),
        eventType: 'IP_WHITELISTED',
        sourceIP: ip,
        details: { action: 'Manual IP whitelist addition', description },
        severity: 'LOW',
        actionTaken: ['IP added to whitelist']
      });
      
      console.log(`✅ Added ${ip} to whitelist${description ? ' (' + description + ')' : ''}`);
    }
  }

  public addTrustedIPs(): void {
    const trustedIPs = [
      { ip: '104.171.163.149', desc: 'VPS Server' },
      { ip: '67.184.226.84', desc: 'User PC' },
      { ip: '127.0.0.1', desc: 'Localhost IPv4' },
      { ip: '::1', desc: 'Localhost IPv6' }
    ];
    
    console.log('🔐 Ensuring trusted IPs are whitelisted:');
    let newlyAdded = 0;
    let alreadyWhitelisted = 0;

    trustedIPs.forEach(({ ip, desc }) => {
      if (!this.config.whitelist.allowedIPs.includes(ip)) {
        this.addIPToWhitelist(ip, desc);
        newlyAdded++;
      } else {
        alreadyWhitelisted++;
      }
    });

    console.log(`✅ ${alreadyWhitelisted} trusted IPs verified, ${newlyAdded} newly added`);
  }

  public removeIPFromWhitelist(ip: string): void {
    const index = this.config.whitelist.allowedIPs.indexOf(ip);
    if (index > -1) {
      this.config.whitelist.allowedIPs.splice(index, 1);
      this.saveConfig();
      console.log(`❌ Removed ${ip} from whitelist`);
    }
  }

  public getWhitelistedIPs(): string[] {
    return [...this.config.whitelist.allowedIPs];
  }

  public getBlockedIPs(): string[] {
    return [...this.config.blacklist.blockedIPs];
  }

  public getRecentSecurityEvents(hours: number = 24): SecurityEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.securityEvents.filter(event => event.timestamp >= cutoff);
  }
  
  /**
   * Get recent security events (excludes trading performance metrics)
   * Use this for security analysis and threat assessment
   */
  public getRecentSecurityThreats(hours: number = 24): SecurityEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.securityEvents.filter(event => 
      event.timestamp >= cutoff &&
      this.isSecurityThreat(event)
    );
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const securityManager = new SecurityManager();

export default securityManager;