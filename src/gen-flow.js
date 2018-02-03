#! /usr/bin/env node

const Factory = require('./MockJSONFactory');
const path = require('path');

const dir = process.argv[2];

if (!dir) {
    console.error('Directory is required!');
    process.exit(2);
}

const factory = new Factory(path.resolve(dir));
console.log(factory.toFlowString());
