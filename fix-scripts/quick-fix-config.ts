import * as fs from 'fs';
import * as path from 'path';

// Fix src/index.ts
const indexPath = path.join(process.cwd(), 'src/index.ts');
let indexFile = fs.readFileSync(indexPath, 'utf8');
indexFile = indexFile.replace('./enhanced/masterConfig', '../z-new-controls/z-masterConfig');
indexFile = indexFile.replace('masterConfig', 'z_masterConfig');
fs.writeFileSync(indexPath, indexFile);
console.log('✅ Fixed src/index.ts');

// Fix src/secure-pool-system.ts
const securePath = path.join(process.cwd(), 'src/secure-pool-system.ts');
if (fs.existsSync(securePath)) {
  let secureFile = fs.readFileSync(securePath, 'utf8');
  secureFile = secureFile.replace('./enhanced/masterConfig', '../z-new-controls/z-masterConfig');
  secureFile = secureFile.replace('masterConfig', 'z_masterConfig');
  fs.writeFileSync(securePath, secureFile);
  console.log('✅ Fixed src/secure-pool-system.ts');
}

console.log('✅ Configuration unified!');