const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

redis.on('connect', () => {
    console.log('🔴 Connected to Redis');
});

redis.on('error', (err) => {
    console.error('❌ Redis error:', err);
});

module.exports = redis;
