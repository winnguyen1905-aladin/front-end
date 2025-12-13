const fs = require('fs');
const path = require('path');
try {
  const p = path.join(process.cwd(), 'node_modules', '@shiguredo', 'noise-suppression', 'README.md');
  console.log(fs.readFileSync(p, 'utf8'));
} catch (e) {
  console.error(e);
}
