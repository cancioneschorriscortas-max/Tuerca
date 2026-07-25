#!/usr/bin/env node
/* Punto de entrada das probas: `node test/run.js` (ou `npm test`). */
const fs = require('fs');
const path = require('path');
const { executarTodas } = require('./probar.js');

const ficheiros = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
if (!ficheiros.length) { console.log('non hai ficheiros .test.js en test/'); process.exit(1); }

console.log(`\nTUERCA — probas (${ficheiros.join(', ')})\n`);
for (const f of ficheiros) require(path.join(__dirname, f));

executarTodas().then((codigo) => process.exit(codigo));
