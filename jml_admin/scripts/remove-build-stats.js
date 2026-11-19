const fs = require('node:fs');
const path = require('node:path');

// UtooPack needs this file while generating HTML, but it is not a runtime asset.
fs.rmSync(path.join(process.cwd(), 'dist', 'stats.json'), { force: true });
