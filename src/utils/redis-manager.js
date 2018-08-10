const Redis = require('ioredis');

class RedisManager {
  constructor() {
    this.redisClient = new Redis(process.env.REDIS_URL);
  }

  get(key) {
    return this.redisClient.get(key);
  }

  set(key, value, timeout) {
    if (timeout) {
      return this.redisClient.set(key, value, 'EX', timeout || 10);
    } else {
      return this.redisClient.set(key, value);
    }
  }
}

module.exports = new RedisManager();
