// Print the JS motion model's canonical constant JSON (PERFECTION_PLAN E-C4).
// Usage: node dump_motion_model.cjs <motion-model.js path>
'use strict';
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(process.argv[2], 'utf8'));
process.stdout.write(global.window.KodroMotion.canonicalJson());
