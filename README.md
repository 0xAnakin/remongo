# remongo

[![Build Status](https://travis-ci.org/syd619/remongo.svg?branch=master)](https://travis-ci.org/syd619/remongo)
[![npm version](https://badge.fury.io/js/remongo.svg)](https://badge.fury.io/js/remongo)
[![Known Vulnerabilities](https://snyk.io/test/github/syd619/remongo/badge.svg?targetFile=package.json)](https://snyk.io/test/github/syd619/remongo?targetFile=package.json)

## Installation

``` bash
$ npm install remongo
```

## Usage

### Mongoose

```javascript
const mongoose = require('mongoose');
const redis = require('redis');
const Remongo = require('remongo');

const client = redic.createClient({
    host: '127.0.0.1',
    port: 6379
})

// default settings
const cache = new Remongo({
    client: client,                     // redis client
    prefix: 'cache',                    // redis key prefix
    ttl: 60,                            // time to live in secs (60 minimum), but cache.set() accepts lower values
    clear: {
        strategy: 'scanUnlinkChunks',   // cache clear method strategies, see Strategies
        chunk: 100                      // cache clear method chunk size, used in scan* strategies
    }
})

cache.attach(mongoose);

```

### Strategies

There are many strategies / ways to clear your cache depending on your env & needs

`delAll` * Will use `KEYS` and then delete all keys found at once using `DEL`

`delSeries` * Will use `KEYS` and delete each key using `DEL` one after another

`unlinkAll` * Will use `KEYS` and then delete all keys found at once using `UNLINK`

`unlinkSeries` * Will use `KEYS` and delete each key using `UNLINK` one after another

`scanDelAll` * Will use `SCAN` with `COUNT` `chunk` defined in options and delete all keys using `DEL`  

`scanDelChunks` * Will use `SCAN` with `COUNT` `chunk` defined in options and delete each chunk of keys one after another using `DEL`

`scanUnlinkAll` * Will use `SCAN` with `COUNT` `chunk` defined in options and delete all keys using `UNLINK`

`scanUnlinkChunks` * Will use `SCAN` with `COUNT` `chunk` defined in options and delete each chunk of keys one after another using `UNLINK`

### API

```javascript

// set
cache.set(key, value, ttl = (this.ttl || 60), cb = noop);

// get 
cache.get(key, cb = noop);

// del
cache.del(key, cb = noop);

// unlink
cache.unlink(key, cb = noop);

// clear
cache.clear(cb = noop);

// attach to mongoose
cache.attach(mongoose);

/**
 * 
 * mongoose
 * 
 */

// basic example
model.find({name:'John'}).populate('data').lean().cache(60).exec(); // populate & lean are supported (in case of lean models are not hydrated!)

// set custom cache key
model.find({name:'John'}).populate('data').lean().cache(60).setCacheKey('oh-poor-john').exec();

// get key (in case of custom)
const query = model.find({name:'John'}).populate('data').lean();
const key = query.getCacheKey(withPrefix = false);

// forget a cache entry
model.find({name:'John'}).populate('data').lean().forget(key); // key is optional but needed in case of custom key used

// forget a cache entry and exec
model.find({name:'John'}).populate('data').lean().forget().exec() // before .exec() you can re-cache etc etc...

```

Aggregate is also supported and has the same methods as mongoose model.
Keep in mind that your model cache keys will have the following format:

- model: `cache:${modelName}:sha1`
- aggregate: `cache:aggregate:sha1`

## Notes

`Versions prior to 2.0.0 are unstable when used with mongoose`

- Need more mocha tests
- Need contributors / maintenairs

## Credits

This library was inspired by the [cachegoose](https://www.npmjs.com/package/cachegoose) project.

## License

(The MIT License)

Copyright (c) 2019 Panagiotis Raditsas

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.