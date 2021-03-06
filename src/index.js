'use strict';

const async = require('async');
const query = require('./lib/query');
const aggregate = require('./lib/aggregate');

const noop = () => {};
const strategies = ['delAll', 'delSeries', 'unlinkAll', 'unlinkSeries', 'scanDelAll', 'scanDelChunks', 'scanUnlinkAll', 'scanUnlinkChunks'];
const defaults = {
    client: null,
    prefix: 'cache',
    ttl: 60,
    clear: {
        strategy: 'scanUnlinkChunks',
        chunk: 100
    }
};

let attached = null;

class Remongo {

    constructor(options = {}) {

        this.options = {
            ...defaults,
            ...options,
            clear: {
                ...defaults.clear,
                ...(options.clear || {})
            }
        };

        if (typeof this.prefix !== 'string' || !this.prefix.trim().length) {
            throw new Error('You must provide a valid cache key prefix.');
        }

        if (!Number.isInteger(this.ttl) || this.ttl < 60) {
            throw new Error('You must provide a valid integer ttl option, minimum is 60 seconds.');
        }

        if (!this.client) {
            throw new Error('You must provide a valid redis client. Check redis & redis-clustr modules.');
        }

        if (!strategies.includes(this.strategy)) {
            throw new Error(`You must provide a valid clear strategy. Available clear strategies are: ${strategies.map((s)=>`'${s}'`).join(', ')}.`);
        }

        if (!Number.isInteger(this.chunk) || this.chunk < 2) {
            throw new Error('You must provide a valid integer chunk size greater than 1.');
        }

    }

    get ttl() {
        return this.options.ttl;
    }

    get client() {
        return this.options.client;
    }

    get prefix() {
        return this.options.prefix;
    }

    get chunk() {
        return this.options.clear.chunk;
    }

    get strategy() {
        return this.options.clear.strategy;
    }

    isAttached() {
        return attached;
    }

    attach(mongoose) {

        if (attached) {
            throw new Error('Remongo already attached');
        }

        query(mongoose, this);
        aggregate(mongoose, this);

        attached = true;

        return this;

    }

    get(key, cb = noop) {

        this.client.get(`${this.prefix}:${key}`, (err, cachedResults) => {

            if (err) {
                cb(err);
            } else if (cachedResults !== null) {
                cb(null, JSON.parse(cachedResults));
            } else {
                cb();
            }

        });

        return this;

    }

    set(key, value, ttl = (this.ttl || 60), cb = noop) {

        if (ttl instanceof Function) {
            cb = ttl;
            ttl = (this.ttl || 60);
        }

        if (ttl < 1) {
            this.client.set(`${this.prefix}:${key}`, JSON.stringify(value), cb);
        } else {
            this.client.setex(`${this.prefix}:${key}`, ttl, JSON.stringify(value), cb);
        }

        return this;

    }

    del(key, cb = noop) {

        if (Array.isArray(key)) {
            this.client.del(key.map((k) => `${this.prefix}:${k}`), cb);
        } else {
            this.client.del(`${this.prefix}:${key}`, cb);
        }

        return this;

    }

    unlink(key, cb = noop) {

        if (Array.isArray(key)) {
            this.client.unlink(key.map((k) => `${this.prefix}:${k}`), cb);
        } else {
            this.client.unlink(`${this.prefix}:${key}`, cb);
        }

        return this;

    }

    clear(cb = noop) {

        switch (this.strategy) {

            case 'delAll':
                {

                    /**
                     * Get all keys by prefix pattern and 
                     * perform del on all keys found
                     */

                    this.client.keys(`${this.prefix}*`, (err, keys) => {

                        if (err) {
                            cb(err);
                        } else {

                            if (!keys.length) {
                                cb();
                            } else {
                                this.client.del(keys, cb);
                            }

                        }

                    });

                    break;

                }

            case 'delSeries':
                {

                    /**
                     * Get all keys by prefix pattern and 
                     * perform del on each key in a serie
                     */

                    this.client.keys(`${this.prefix}*`, (err, keys) => {

                        if (err) {
                            cb(err);
                        } else {

                            if (!keys.length) {
                                cb();
                            } else {

                                async.eachSeries(keys, (key, done) => {

                                    this.client.del(key, done);

                                }, cb);

                            }

                        }

                    });

                    break;

                }

            case 'unlinkAll':
                {

                    /**
                     * Get all keys by prefix pattern and 
                     * perform unlink on keys found
                     */

                    this.client.keys(`${this.prefix}*`, (err, keys) => {

                        if (err) {
                            cb(err);
                        } else {

                            if (!keys.length) {
                                cb();
                            } else {
                                this.client.unlink(keys, cb);
                            }

                        }

                    });

                    break;

                }

            case 'unlinkSeries':
                {

                    /**
                     * Get all keys by prefix pattern and 
                     * perform unlink on each key in a serie
                     */

                    this.client.keys(`${this.prefix}*`, (err, keys) => {

                        if (err) {
                            cb(err);
                        } else {

                            if (!keys.length) {
                                cb();
                            } else {

                                async.eachSeries(keys, (key, done) => {

                                    this.client.unlink(key, done);

                                }, cb);

                            }

                        }

                    });

                    break;

                }

            case 'scanDelAll':
                {

                    /**
                     * Scan for keys by prefix pattern in chunks 
                     * and perform del on total matches found
                     */

                    let cursor = '0';
                    let matches = [];

                    const scan = () => {

                        this.client.send_command('SCAN', [cursor, 'MATCH', `${this.prefix}*`, 'COUNT', this.chunk], (err, results) => {

                            if (err) {
                                cb(err);
                            } else {

                                cursor = results[0];

                                if (results[1].length) {
                                    matches = matches.concat(results[1]);
                                }

                                if (cursor !== '0') {
                                    scan();
                                } else if (matches.length) {
                                    this.client.del(matches, cb);
                                } else {
                                    cb();
                                }

                            }

                        })

                    }

                    scan();

                    break;

                }

            case 'scanDelChunks':
                {

                    /**
                     * Scan for keys by prefix pattern in chunks 
                     * and perform del on each chunk
                     */

                    let cursor = '0';
                    let matches = [];

                    const scan = () => {

                        this.client.send_command('SCAN', [cursor, 'MATCH', `${this.prefix}*`, 'COUNT', this.chunk], (err, results) => {

                            if (err) {
                                cb(err);
                            } else {

                                cursor = results[0];
                                matches = results[1];

                                if (matches.length) {

                                    this.client.del(matches, (err) => {

                                        if (err) {
                                            cb(err);
                                        } else {
                                            scan();
                                        }

                                    })

                                } else if (cursor !== '0') {
                                    scan();
                                } else {
                                    cb();
                                }

                            }

                        })

                    }

                    scan();

                    break;

                }

            case 'scanUnlinkAll':
                {

                    /**
                     * Scan for keys by prefix pattern in chunks 
                     * and perform unlink on total matches found
                     */

                    let cursor = '0';
                    let matches = [];

                    const scan = () => {

                        this.client.send_command('SCAN', [cursor, 'MATCH', `${this.prefix}*`, 'COUNT', this.chunk], (err, results) => {

                            if (err) {
                                cb(err);
                            } else {

                                cursor = results[0];

                                if (results[1].length) {
                                    matches = matches.concat(results[1]);
                                }

                                if (cursor !== '0') {
                                    scan();
                                } else if (matches.length) {
                                    this.client.unlink(matches, cb);
                                } else {
                                    cb();
                                }

                            }

                        })

                    }

                    scan();

                    break;

                }

            case 'scanUnlinkChunks':
                {

                    /**
                     * Scan for keys by prefix pattern in chunks 
                     * and perform unlink on each chunk
                     */

                    let cursor = '0';
                    let matches = [];

                    const scan = () => {

                        this.client.send_command('SCAN', [cursor, 'MATCH', `${this.prefix}*`, 'COUNT', this.chunk], (err, results) => {

                            if (err) {
                                cb(err);
                            } else {

                                cursor = results[0];
                                matches = results[1];

                                if (matches.length) {

                                    this.client.unlink(matches, (err) => {

                                        if (err) {
                                            cb(err);
                                        } else {
                                            scan();
                                        }

                                    })

                                } else if (cursor !== '0') {
                                    scan();
                                } else {
                                    cb();
                                }

                            }

                        })

                    }

                    scan();

                    break;

                }

            default:
                {
                    throw new Error(`Unhandled clear strategy type '${this.strategy}'.`);
                }

        }

        return this;

    }

}

module.exports = Remongo;