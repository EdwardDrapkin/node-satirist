/* eslint-disable no-console */

const assert = require('./assert');

after(() => {
    const pretty = ` 👀 ${assert.pretty()}`;
    const line = ''.padEnd(pretty.length, '-');
    console.log(`  ┌${line}┐`);
    console.log(`  |${pretty}|`);
    console.log(`  └${line}┘\n`);
});
