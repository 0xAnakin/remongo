'use strict';

const jsosort = require('jsosort');
const crypto = require('crypto');

exports.generateKey = (obj) => {
    return crypto.createHash('sha1').update(JSON.stringify(jsosort(obj), (key, val) => {
        return (val instanceof RegExp) ? String(val) : val;
    })).digest('hex');
}