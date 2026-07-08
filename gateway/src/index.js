const dotenv = require("dotenv");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { authenticateJwt, createDemoToken } = require("./auth");
const { getHealthSnapshot, isInstanceHealthy, startHealthChecks } = require("./healthChecker");
const { RoundRobinLoadBalancer } = require("./loadBalancer");
const { recordRequest, recordUpstreamError, renderMetrics } = require("./metrics");
const { rateLimiter } = require("./rateLimiter");
const { connectRedis } = require("./redisClient");

dotenv.config();

const app = express();
const port = Number(process.env.GATEWAY_PORT) || 3000;

const loadBalancer = new RoundRobinLoadBalancer({
  users: [
    { name: "user-service-1", url: process.env.USER_SERVICE_1_URL || "http://localhost:4001" },
    { name: "user-service-2", url: process.env.USER_SERVICE_2_URL || "http://localhost:4002" }
  ],
  orders: [
    { name: "order-service-1", url: process.env.ORDER_SERVICE_1_URL || "http://localhost:5001" },
    { name: "order-service-2", url: process.env.ORDER_SERVICE_2_URL || "http://localhost:5002" }
  ],
  products: [
    { name: "product-service-1", url: process.env.PRODUCT_SERVICE_1_URL || "http://localhost:6001" },
    { name: "product-service-2", url: process.env.PRODUCT_SERVICE_2_URL || "http://localhost:6002" }
  ]
});

function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const selectedService = req.selectedServiceInstance || "gateway";

    recordRequest(req, res.statusCode, durationMs, selectedService);

    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${selectedService} ${res.statusCode} ${durationMs}ms`
    );
  });

  next();
}

function selectHealthyInstance(serviceName) {
  return async (req, res, next) => {
    try {
      const registry = loadBalancer.getRegistry();
      const healthResults = await Promise.all(
        registry[serviceName].map(async (instance) => ({
          instance,
          healthy: await isInstanceHealthy(instance.name)
        }))
      );
      const healthyInstanceNames = healthResults
        .filter((result) => result.healthy)
        .map((result) => result.instance.name);
      const selectedInstance = loadBalancer.getNextHealthyInstance(serviceName, healthyInstanceNames);

      if (!selectedInstance) {
        req.selectedServiceInstance = `${serviceName}:no-healthy-instance`;
        return res.status(503).json({
          error: "Service Unavailable",
          message: `No healthy ${serviceName} service instances are available`
        });
      }

      req.selectedInstance = selectedInstance;
      req.selectedServiceInstance = selectedInstance.name;
      req.selectedServiceUrl = selectedInstance.url;

      next();
    } catch (error) {
      console.error("Health cache lookup failed:", error);
      return res.status(503).json({
        error: "Service Unavailable",
        message: "Gateway cannot read service health right now"
      });
    }
  };
}

function createServiceProxy(serviceName) {
  return createProxyMiddleware({
    target: "http://localhost",
    changeOrigin: true,
    router: (req) => req.selectedServiceUrl || "http://localhost",
    pathRewrite: (_path, req) => req.originalUrl,
    proxyTimeout: 5000,
    on: {
      error(error, req, res) {
        console.error(
          `Proxy error while calling ${req.selectedServiceInstance || serviceName}:`,
          error.message
        );
        recordUpstreamError();

        if ("writeHead" in res && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Bad Gateway",
              message: `Gateway could not reach ${serviceName} service`
            })
          );
        }
      }
    }
  });
}

app.use(requestLogger);

app.get("/login", (_req, res) => {
  res.json({
    token: createDemoToken(),
    tokenType: "Bearer",
    expiresIn: "1h"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    service: "api-gateway",
    status: "UP",
    loadBalancer: loadBalancer.getRegistry()
  });
});

app.get("/health-cache", async (_req, res) => {
  try {
    res.json({
      service: "api-gateway",
      healthCache: await getHealthSnapshot(loadBalancer.getRegistry())
    });
  } catch {
    res.status(503).json({
      error: "Service Unavailable",
      message: "Gateway cannot read health cache right now"
    });
  }
});

app.get("/metrics", async (_req, res) => {
  try {
    const healthSnapshot = await getHealthSnapshot(loadBalancer.getRegistry());
    res.type("text/plain").send(renderMetrics(healthSnapshot));
  } catch {
    res.type("text/plain").send(renderMetrics({}));
  }
});

app.use(authenticateJwt);
app.use(rateLimiter);

app.use("/users", selectHealthyInstance("users"), createServiceProxy("users"));
app.use("/orders", selectHealthyInstance("orders"), createServiceProxy("orders"));
app.use("/products", selectHealthyInstance("products"), createServiceProxy("products"));

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
    availableRoutes: ["/users", "/orders", "/products", "/health"]
  });
});

async function startGateway() {
  await connectRedis();
  startHealthChecks(loadBalancer.getRegistry());

  app.listen(port, () => {
    console.log(`API Gateway running on http://localhost:${port}`);
    console.log("Round Robin registry:", loadBalancer.getRegistry());
  });
}

if (require.main === module) {
  startGateway().catch((error) => {
    console.error("Gateway failed to start:", error);
    process.exit(1);
  });
}

module.exports = {
  app,
  loadBalancer,
  startGateway
};
