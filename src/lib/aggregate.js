'use strict';

const utils = require('./utils');

module.exports = (mongoose, remongo) => {

    const aggregate = mongoose.Model.aggregate;

    const extend = (ctor) => {

        const exec = ctor.prototype.exec;

        ctor.prototype.exec = function (callback = noop) {

            if (!this.hasOwnProperty('_ttl')) {
                return exec.apply(this, arguments);
            }

            const key = this.getCacheKey();
            const ttl = this._ttl;

            return new Promise((resolve, reject) => {

                remongo.get(key, (err, cachedResults) => { //eslint-disable-line handle-callback-err

                    if (err) {

                        callback(err);

                        return reject(err);

                    } else if (cachedResults) {

                        /**
                         * Handle cached results
                         */

                        callback(null, cachedResults);

                        return resolve(cachedResults);

                    }

                    /**
                     * 
                     * No cached results found. 
                     * Get results from mongo and cache them
                     * 
                     */

                    exec.call(this).then((results) => {

                        cache.set(key, results, ttl, () => {

                            callback(null, results);

                            return resolve(results);

                        });

                    }).catch((err) => {

                        callback(err);

                        return reject(err);

                    });

                });

            });

        }

        /**
         * invalidate this querys cache
         */
        ctor.prototype.forget = function (key) {

            key = key ? `aggregate:${this._key}` : this.getCacheKey();

            delete this._ttl;
            delete this._key;

            remongo.unlink(key);

            return this;

        }

        /**
         * cache this query and optionally set other ttl
         */
        ctor.prototype.cache = function (ttl = (remongo.ttl || 60)) {

            this._ttl = ttl;

            return this;

        }

        /**
         * set query cache key
         */
        ctor.prototype.setCacheKey = function (key) {

            this._key = key ? `aggregate:${key}` : `aggregate:${this.generateCacheKeyHash()}`;

            return this;

        }

        /**
         * get query cache key
         */
        ctor.prototype.getCacheKey = function (withPrefix = false) {

            if (withPrefix) {
                return this._key ? `${remongo.prefix}:${this._key}` : `${remongo.prefix}:aggregate:${utils.generateKey(this._pipeline)}`;
            }

            return this._key || `aggregate:${utils.generateKey(this._pipeline)}`;

        }

    }

    /**
     * extend aggregate
     */
    mongoose.Model.aggregate = function () {

        const res = aggregate.apply(this, arguments);

        if (!remongo.isAttached()) {

            if (res instanceof Aggregate) {
                extend(res.constructor);
            } else {
                console.warn(`Could not extend 'mongoose.Model.aggregate'`);
            }

        }

        return res;

    }

}