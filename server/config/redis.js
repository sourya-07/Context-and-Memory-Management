// On Vercel (serverless), connections can't persist across requests,
// so we use a lazy connect pattern — connecting on first use if not already connected.

const { createClient } = require("redis")

const redisClient = createClient({
    url: process.env.REDIS_URL || "",
})

redisClient.on("error", (err) => {
    // Log but don't crash — if Redis is down, we just skip caching
    console.warn("Redis error (non-fatal):", err.message)
})

// Track whether we've connected so we don't try again on each request
let isConnected = false

// Connect to Redis. Safe to call multiple times — skips if already connected.
async function connectRedis() {
    if (!process.env.REDIS_URL) {
        console.warn("REDIS_URL not set — Redis caching is disabled")
        return
    }
    if (isConnected || redisClient.isOpen) {
        return
    }
    try {
        await redisClient.connect()
        isConnected = true
        console.log("Redis connected")
    } catch (err) {
        console.warn("Could not connect to Redis:", err.message)
    }
}

// Wraps redisClient.get — silently returns null if Redis isn't available
async function safeGet(key) {
    try {
        await connectRedis()
        return await redisClient.get(key)
    } catch {
        return null
    }
}

// Wraps redisClient.setEx — silently skips if Redis isn't available
async function safeSetEx(key, ttl, value) {
    try {
        await connectRedis()
        await redisClient.setEx(key, ttl, value)
    } catch {
        // non-fatal — context will just be recomputed next request
    }
}

// Wraps redisClient.del — silently skips if Redis isn't available
async function safeDel(key) {
    try {
        await connectRedis()
        await redisClient.del(key)
    } catch {
        // non-fatal — stale cache will expire naturally
    }
}

module.exports = { redisClient, connectRedis, safeGet, safeSetEx, safeDel }