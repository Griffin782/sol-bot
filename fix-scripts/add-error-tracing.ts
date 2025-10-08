#!/usr/bin/env node
// add-error-tracing.ts - Add comprehensive error tracking

import * as fs from 'fs';

console.log('🚨 ADDING ERROR INJECTION & TRACING');
console.log('='.repeat(50));

// Add error wrapper to key files
const filesToEnhance = ['src/index.ts', 'src/configBridge.ts'];

filesToEnhance.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add error tracing wrapper at top
  const errorWrapper = `
// ERROR TRACING WRAPPER
function traceError(operation: string, data: any = {}) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function(...args: any[]) {
      try {
        return originalMethod.apply(this, args);
      } catch (error) {
        console.error('[ERROR_TRACE]', {
          file: __filename,
          operation,
          function: propertyKey,
          line: new Error().stack?.split('\\n')[2],
          error: error.message,
          data
        });
        throw error;
      }
    };
  };
}
`;

  if (!content.includes('ERROR_TRACE')) {
    content = errorWrapper + '\n' + content;
    fs.writeFileSync(filePath, content);
    console.log(`✅ Added error tracing to: ${filePath}`);
  }
});

console.log('\n✅ Error injection complete!');
