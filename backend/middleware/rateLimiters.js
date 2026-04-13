const rateLimitMaps = new Map(); // Stores Map for each limiter instance

// Factory function to create a rate limiter
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 5, // 5 attempts default
    message = 'Muitas requisições. Tente novamente mais tarde.',
    keyPrefix = 'default' // Unique key to separate limiters in cleanup
  } = options;

  // Each limiter gets its own Map for tracking IPs
  const limitMap = new Map();
  rateLimitMaps.set(keyPrefix, { map: limitMap, windowMs });

  return (req, res, next) => {
    // Get IP
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();
    const record = limitMap.get(ip);

    if (!record) {
      limitMap.set(ip, { count: 1, firstRequestTime: now });
      return next();
    }

    if (now - record.firstRequestTime > windowMs) {
      // Window expired, reset
      limitMap.set(ip, { count: 1, firstRequestTime: now });
      return next();
    }

    if (record.count >= max) {
      console.warn(`🛑 Rate limit exceeded [${keyPrefix}] for IP: ${ip}`);
      return res.status(429).json({ message });
    }

    record.count += 1;
    next();
  };
};

// Global cleanup loop (runs every 10 mins)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [prefix, { map, windowMs }] of rateLimitMaps.entries()) {
    for (const [ip, record] of map.entries()) {
      if (now - record.firstRequestTime > windowMs) {
        map.delete(ip);
      }
    }
  }
}, 10 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

const loginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 mins
  max: 5,
  message: 'Muitas tentativas de login. Tente novamente em 5 minutos.',
  keyPrefix: 'login'
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Muitos registros criados deste IP. Tente novamente em 1 hora.',
  keyPrefix: 'register'
});

const publicChatLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute (approx 1 per 2 seconds)
  message: 'Você está enviando mensagens muito rápido. Aguarde um momento.',
  keyPrefix: 'public_chat'
});

export { loginLimiter, registerLimiter, publicChatLimiter, createRateLimiter };
