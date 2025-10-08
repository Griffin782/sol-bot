// Simple Email Test Script for SOL-BOT Security System
// Sends a test email to ws15day@gmail.com without triggering security events

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function sendTestEmail() {
  console.log('📧 SOL-BOT Email Delivery Test');
  console.log('='.repeat(40));
  
  // Load security configuration
  const configPath = path.join(__dirname, 'dist', 'data', 'security_config.json');
  
  let config;
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (error) {
    console.error('❌ Failed to load security config:', error.message);
    return;
  }
  
  if (!config.alerts.email.enabled) {
    console.log('⚠️  Email alerts are disabled in configuration');
    console.log('   Update security_config.json to enable email alerts');
    return;
  }
  
  const emailConfig = config.alerts.email;
  const smtpConfig = emailConfig.smtpConfig;
  
  console.log('📋 Email Configuration:');
  console.log(`   Target: ${emailConfig.emailAddress}`);
  console.log(`   SMTP Host: ${smtpConfig.host}:${smtpConfig.port}`);
  console.log(`   Secure: ${smtpConfig.secure}`);
  console.log(`   User: ${smtpConfig.auth.user}`);
  console.log('');
  
  // Check if credentials are configured
  if (!smtpConfig.auth.user || !smtpConfig.auth.pass || 
      smtpConfig.auth.user === 'your-email@gmail.com' || 
      smtpConfig.auth.pass === 'your-app-password') {
    
    console.log('⚠️  SMTP credentials not configured!');
    console.log('');
    console.log('📝 To configure Gmail SMTP:');
    console.log('1. Enable 2-factor authentication on your Gmail account');
    console.log('2. Generate an App Password:');
    console.log('   • Go to Google Account > Security > App passwords');
    console.log('   • Select "Mail" and generate password');
    console.log('3. Update security_config.json with your credentials:');
    console.log('   • "user": "your-actual-email@gmail.com"');
    console.log('   • "pass": "your-generated-app-password"');
    console.log('');
    console.log('🔗 Gmail App Password Guide:');
    console.log('   https://support.google.com/accounts/answer/185833');
    console.log('');
    
    // Show example email that would be sent
    console.log('📧 Example Email (SIMULATION MODE):');
    console.log('-'.repeat(40));
    
    const testTemplate = config.alerts.templates.testMessage;
    const testData = {
      timestamp: new Date().toISOString(),
      testType: 'Manual Email Test',
      systemStatus: 'Testing Mode'
    };
    
    const subject = formatMessage(testTemplate.email.subject, testData);
    const body = formatMessage(testTemplate.email.body, testData);
    
    console.log(`To: ${emailConfig.emailAddress}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:`);
    console.log(body);
    console.log('-'.repeat(40));
    
    return;
  }
  
  // Create transporter
  console.log('🔧 Creating SMTP transporter...');
  const transporter = nodemailer.createTransporter(smtpConfig);
  
  // Test connection
  console.log('📡 Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    console.log('');
    console.log('🔍 Troubleshooting tips:');
    console.log('• Verify your email and app password are correct');
    console.log('• Ensure 2-factor authentication is enabled');
    console.log('• Check that "Less secure app access" is disabled (use App Passwords instead)');
    console.log('• Verify network connectivity to smtp.gmail.com:587');
    return;
  }
  
  // Prepare test email
  console.log('📝 Preparing test email...');
  
  const testTemplate = config.alerts.templates.testMessage;
  const testData = {
    timestamp: new Date().toISOString(),
    testType: 'Manual Email Test',
    systemStatus: 'All Systems Operational'
  };
  
  const subject = formatMessage(testTemplate.email.subject, testData);
  const body = formatMessage(testTemplate.email.body, testData);
  
  const mailOptions = {
    from: `"SOL-BOT Security" <${smtpConfig.auth.user}>`,
    to: emailConfig.emailAddress,
    subject: subject,
    text: body,
    html: body.replace(/\n/g, '<br>')
  };
  
  console.log('📧 Email Details:');
  console.log(`   From: ${mailOptions.from}`);
  console.log(`   To: ${mailOptions.to}`);
  console.log(`   Subject: ${mailOptions.subject}`);
  console.log('   Body Preview:', body.substring(0, 100) + '...');
  console.log('');
  
  // Send email
  console.log('🚀 Sending test email...');
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log('');
    console.log('📬 Check your inbox at ws15day@gmail.com');
    console.log('   (It may take a few minutes to arrive)');
    
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    console.log('');
    console.log('🔍 Common issues:');
    console.log('• Invalid app password');
    console.log('• 2-factor authentication not enabled');
    console.log('• Gmail security settings blocking the connection');
    console.log('• Network/firewall issues');
  }
  
  // Test additional templates
  console.log('\n🧪 Testing Additional Email Templates:');
  console.log('-'.repeat(40));
  
  await testTemplate('Security Alert', config.alerts.templates.intrusionDetected, {
    sourceIP: '192.168.1.100',
    pattern: 'MULTIPLE_RAPID',
    timestamp: new Date().toISOString(),
    actions: ['IP blocked', 'Alerts sent']
  }, transporter, mailOptions.from, emailConfig.emailAddress);
  
  await testTemplate('Emergency Event', config.alerts.templates.emergencyEvent, {
    eventType: 'SYSTEM_COMPROMISE',
    timestamp: new Date().toISOString(),
    conditions: ['Multiple intrusion attempts'],
    actions: ['Trading halted', 'Emergency protocols activated']
  }, transporter, mailOptions.from, emailConfig.emailAddress);
  
  console.log('\n✅ Email testing completed!');
}

// Helper function to format message templates
function formatMessage(template, data) {
  let message = template;
  
  // Replace all data placeholders
  Object.keys(data).forEach(key => {
    const placeholder = `{${key}}`;
    // Simple string replacement - much more reliable
    while (message.includes(placeholder)) {
      message = message.replace(placeholder, data[key]);
    }
  });
  
  // Replace timestamp if not already replaced
  if (message.includes('{timestamp}')) {
    message = message.replace(/{timestamp}/g, new Date().toISOString());
  }
  
  // Replace any remaining unreplaced placeholders with 'N/A'
  message = message.replace(/{[^}]+}/g, 'N/A');
  
  return message;
}

// Test individual templates
async function testTemplate(name, template, data, transporter, from, to) {
  console.log(`\n📋 ${name} Template:`);
  
  if (!template || !template.email) {
    console.log('   ⚠️  Template not found');
    return;
  }
  
  const subject = formatMessage(template.email.subject, data);
  const body = formatMessage(template.email.body, data);
  
  console.log(`   Subject: ${subject}`);
  console.log(`   Body Preview: ${body.substring(0, 80).replace(/\n/g, ' ')}...`);
  
  // Optionally send this template too (commented out to avoid spam)
  /*
  try {
    const mailOptions = {
      from: `"SOL-BOT Security Test" <${from.split('<')[1].split('>')[0]}>`,
      to: to,
      subject: `[TEST] ${subject}`,
      text: `[TEST EMAIL - NOT A REAL ALERT]\n\n${body}`,
      html: `<p><strong>[TEST EMAIL - NOT A REAL ALERT]</strong></p><br>${body.replace(/\n/g, '<br>')}`
    };
    
    await transporter.sendMail(mailOptions);
    console.log('   ✅ Test template sent');
  } catch (error) {
    console.log('   ❌ Failed to send template test:', error.message);
  }
  */
}

// Run the test
sendTestEmail().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});