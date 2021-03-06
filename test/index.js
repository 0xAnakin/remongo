const redis = require('redis');
const async = require('async');
const assert = require('assert');
const Remongo = require('../src');

const strategies = ['delAll', 'delSeries', 'unlinkAll', 'unlinkSeries', 'scanDelAll', 'scanDelChunks', 'scanUnlinkAll', 'scanUnlinkChunks'];
const client = redis.createClient({
    host: '127.0.0.1',
    port: 6379
});

let remongo = null;

describe('remongo', () => {

    beforeEach((done) => {

        remongo = new Remongo({
            client: client,
            ttl: 120,
            prefix: 'cache'
        });

        done();

    });

    afterEach((done) => {
        remongo.clear(done);
    });

    it('should have main methods & properties', () => {

        assert.ok(remongo.ttl);
        assert.ok(remongo.client);
        assert.ok(remongo.prefix);
        assert.ok(remongo.chunk);
        assert.ok(remongo.strategy);

        assert.ok(remongo.set);
        assert.ok(remongo.get);
        assert.ok(remongo.del);
        assert.ok(remongo.clear);
        assert.ok(remongo.unlink);
        assert.ok(remongo.attach);
        assert.ok(remongo.isAttached);

    });

    it('should store items', (done) => {

        remongo.set('test1', {
            a: 1
        }, (err) => {

            if (err) {
                return done(err);
            }

            remongo.get('test1', (err, data) => {

                if (err) {
                    return done(err);
                }

                assert.equal(data.a, 1);

                done();

            })

        });

    });

    it('should store zero', (done) => {

        remongo.set('test2', 0, (err) => {

            if (err) {
                return done(err);
            }

            remongo.get('test2', (err, data) => {

                if (err) {
                    return done(err);
                }

                assert.strictEqual(data, 0);

                done();

            });

        });

    });

    it('should store false', (done) => {

        remongo.set('test3', false, (err) => {

            if (err) {
                return done(err);
            }

            remongo.get('test3', (err, data) => {

                if (err) {
                    return done(err);
                }

                assert.strictEqual(data, false)

                done();

            });

        });

    });

    it('should store null', (done) => {

        remongo.set('test4', null, (err) => {

            if (err) {
                return done(err);
            }

            remongo.get('test4', (err, data) => {

                if (err) {
                    return done(err);
                }

                assert.strictEqual(data, null);

                done();

            });

        });

    });

    it('should delete items', (done) => {

        let value = Date.now()

        remongo.set('test5', value, (err) => {

            if (err) {
                return done(err);
            }

            remongo.get('test5', (err, data) => {

                if (err) {
                    return done(err);
                }

                assert.equal(data, value);

                remongo.del('test5', (err) => {

                    if (err) {
                        return done(err);
                    }

                    remongo.get('test5', (err, data) => {

                        if (err) {
                            return done(err);
                        }

                        assert.equal(data, null);

                        done();

                    });

                });

            });

        });

    });

    it('should expire key', function (done) {

        this.timeout(0);

        remongo.set('test6', {
            a: 1
        }, 1, (err) => {

            if (err) {
                return done(err);
            }

            setTimeout(() => {

                remongo.get('test6', (err, data) => {

                    if (err) {
                        return done(err);
                    }

                    assert.equal(data, null);

                    done();

                });

            }, 1100);

        });

    });

    it('should not expire key', function (done) {

        this.timeout(0);

        remongo.set('test7', {
            a: 1
        }, -1, (err) => {

            if (err) {
                return done(err);
            }

            setTimeout(() => {

                remongo.get('test7', (err, data) => {

                    if (err) {
                        return done(err);
                    }

                    assert.deepEqual(data, {
                        a: 1
                    });

                    done();

                })

            }, 1000);

        });

    });

    async.forEachOf(strategies, (strategy, index, cb) => {

        it(`should clear items with strategy '${strategy}'`, function (done) {

            this.timeout(0);

            remongo.options.clear.strategy = strategy;

            let value = Date.now()

            remongo.set(`clear-strategy-test${index}`, value, (err) => {

                if (err) {
                    return done(err);
                }

                remongo.get(`clear-strategy-test${index}`, (err, data) => {

                    if (err) {
                        return done(err);
                    }

                    assert.equal(data, value);

                    remongo.clear((err) => {

                        if (err) {
                            return done(err);
                        }

                        remongo.get(`clear-strategy-test${index}`, (err, data) => {

                            if (err) {
                                return done(err);
                            }

                            assert.equal(data, null);

                            done();
                            cb();

                        });

                    });

                });

            });

        });

    });

});