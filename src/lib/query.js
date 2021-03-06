'use strict';

const utils = require('./utils');
const noop = function () {};

module.exports = function (mongoose, remongo) {

    const exec = mongoose.Query.prototype.exec;

    mongoose.Query.prototype.exec = function (op, callback = noop) {

        /**
         * If no _ttl is found just get data from mongo
         */

        if (!this.hasOwnProperty('_ttl')) {
            return exec.apply(this, arguments);
        }

        /**
         * Validate arguments as mongoose Query.exec() does
         */

        if (typeof op === 'function') {
            callback = op;
            op = null;
        } else if (typeof op === 'string') {
            this.op = op;
        }

        /**
         * Declare some variables because whty not?
         */

        const key = this.getCacheKey();
        const ttl = this._ttl;
        const isCount = ['count', 'countDocuments', 'estimatedDocumentCount'].includes(this.op);
        const isLean = this._mongooseOptions.lean;
        const model = this.model.modelName;

        return new Promise((resolve, reject) => {

            remongo.get(key, (err, cachedResults) => {

                if (err) {

                    callback(err);

                    return reject(cachedResults);

                } else if (cachedResults) {

                    /**
                     * Handle cached results
                     */

                    if (isCount) {

                        callback(null, cachedResults);

                        return resolve(cachedResults);

                    }

                    if (!isLean) {

                        const constructor = mongoose.model(model);

                        cachedResults = Array.isArray(cachedResults) ? cachedResults.map(hydrateModel(constructor)) : hydrateModel(constructor)(cachedResults);

                    }

                    callback(null, cachedResults);

                    return resolve(cachedResults);

                }

                /**
                 * 
                 * No cached results found. 
                 * Get results from mongo and cache them
                 * 
                 */

                exec.call(this).then((mongoResults) => {

                    remongo.set(key, mongoResults, ttl, () => {

                        callback(null, mongoResults);

                        return resolve(mongoResults);

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
    mongoose.Query.prototype.forget = function (key) {

        key = key ? `${this.model.modelName}:${key}` : this.getCacheKey();

        delete this._ttl;
        delete this._key;

        remongo.unlink(key);

        return this;

    }

    /**
     * cache this query and optionally set other ttl
     */
    mongoose.Query.prototype.cache = function (ttl = (remongo.ttl || 60)) {

        this._ttl = ttl;

        return this;

    }

    /**
     * set query cache key
     */
    mongoose.Query.prototype.setCacheKey = function (key) {

        this._key = key ? `${this.model.modelName}:${key}` : `${this.model.modelName}:${this.generateCacheKeyHash()}`;

        return this;

    }

    /**
     * get query cache key
     */
    mongoose.Query.prototype.getCacheKey = function (withPrefix = false) {

        if (withPrefix) {
            return this._key ? `${remongo.prefix}:${this._key}` : `${remongo.prefix}:${this.model.modelName}:${this.generateCacheKeyHash()}`;
        }

        return this._key || `${this.model.modelName}:${this.generateCacheKeyHash()}`;

    }

    /**
     * generate hash based on various stuff
     */
    mongoose.Query.prototype.generateCacheKeyHash = function () {

        const key = {
            model: this.model.modelName,
            op: this.op,
            skip: this.options.skip,
            limit: this.options.limit,
            sort: this.options.sort,
            _options: this._mongooseOptions,
            _conditions: this._conditions,
            _fields: this._fields,
            _path: this._path,
            _distinct: this._distinct
        };

        return utils.generateKey(key);

    }

};

/**
 * 
 * @param {*} constructor Mongoose model constructor
 * @description Hydrate model
 *  
 */
function hydrateModel(constructor) {
    return (data) => {
        return constructor.hydrate(data);
    }
}