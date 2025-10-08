// test-config.js - Test if masterConfig loads
const path = require('path');

try {
  // Try to load the compiled masterConfig
  const configPath = path.join(__dirname, 'dist', 'enhanced', 'masterConfig.js');
  const { masterConfig } = require(configPath);
  
  console.log('✅ Config Loaded Successfully!');
  console.log('Target Pool:', masterConfig.pool?.targetPool);
  console.log('Position Size:', masterConfig.pool?.positionSize);
  console.log('Test Mode:', masterConfig.bot?.testMode);
} catch (error) {
  console.log('❌ Error loading config:', error.message);
  console.log('Make sure to run: npx tsc');
}