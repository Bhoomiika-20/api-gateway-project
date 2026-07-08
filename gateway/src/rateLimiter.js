const { recordRateLimitedRequest } = require("./metrics");
const { redisClient } = require("./redisClient");

const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS) || 60;
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 20;

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

async function rateLimiter(req, res, next) {
  try {
    const key = `rate_limit:${getClientIp(req)}`;
    const currentCount = await redisClient.incr(key);

    if (currentCount === 1) {
      await redisClient.expire(key, windowSeconds);
    }

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(maxRequests - currentCount, 0));

    if (currentCount > maxRequests) {
      recordRateLimitedRequest();
      return res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again after ${windowSeconds} seconds.`
      });
    }

    next();
  } catch (error) {
    console.error("Rate limiter failed:", error);
    res.status(503).json({
      error: "Service Unavailable",
      message: "Gateway cannot check rate limit right now"
    });
  }
}

module.exports = {
  rateLimiter
};
