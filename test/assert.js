// @flow

const { assert } = require('chai');

assert.count = 0;
assert.duration = [0, 0];
assert.pretty = () => {
    const time = ((assert.duration[0] * 1e9) + assert.duration[1]) / 1e6;

    return `Watched ${assert.count} assertions over ${time}ms.`;
};

const handler = {
    get(target, key) {
        // gotta special case this or it counts itself
        if (key === 'pretty') {
            return target[key];
        }
        return new Proxy(target[key], handler);
    },

    apply(target, that, args) {
        assert.count += 1;
        const hrstart = process.hrtime();

        try {
            return target.apply(that, args);
        } finally {
            const hrend = process.hrtime(hrstart);
            assert.duration[0] += hrend[0];
            assert.duration[1] += hrend[1];
        }
    },
};

module.exports = new Proxy(assert, handler);

