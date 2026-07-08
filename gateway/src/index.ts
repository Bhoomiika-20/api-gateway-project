import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { RoundRobinLoadBalancer, ServiceInstance, ServiceName } from "./loadBalancer";
import { authenticateJwt, createDemoToken } from "./auth";
import { getHealthSnapshot, isInstanceHealthy, startHealthChecks } from "./healthChecker";
import { recordRequest, recordUpstreamError, renderMetrics } from "./metrics";
import { rateLimiter } from "./rateLimiter";
import { connectRedis } from "./redisClient";

dotenv.config();

const app = express();

const port = Number(process.env.GATEWAY_PORT) || 3000;

type GatewayRequest = Request & {
  selectedServiceInstance?: string;
  selectedServiceUrl?: string;
  selectedInstance?: ServiceInstance;
};

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

function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const gatewayReq = req as GatewayRequest;
    const durationMs = Date.now() - startedAt;
    const selectedService = gatewayReq.selectedServiceInstance || "gateway";

    recordRequest(req, res.statusCode, durationMs, selectedService);

    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${selectedService} ${res.statusCode} ${durationMs}ms`
    );
  });

  next();
}

function selectHealthyInstance(serviceName: ServiceName) {
  return async (req: Request, res: Response, next: NextFunction) => {
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
      const gatewayReq = req as GatewayRequest;

      if (!selectedInstance) {
        gatewayReq.selectedServiceInstance = `${serviceName}:no-healthy-instance`;
        return res.status(503).json({
          error: "Service Unavailable",
          message: `No healthy ${serviceName} service instances are available`
        });
      }

      gatewayReq.selectedInstance = selectedInstance;
      gatewayReq.selectedServiceInstance = selectedInstance.name;
      gatewayReq.selectedServiceUrl = selectedInstance.url;

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

function createServiceProxy(serviceName: ServiceName) {
  return createProxyMiddleware({
    target: "http://localhost",
    changeOrigin: true,
    router: (req) => (req as GatewayRequest).selectedServiceUrl || "http://localhost",
    pathRewrite: (_path, req) => (req as Request).originalUrl,
    proxyTimeout: 5000,
    on: {
      error(error, _req, res) {
        const gatewayReq = _req as GatewayRequest;
        console.error(
          `Proxy error while calling ${gatewayReq.selectedServiceInstance || serviceName}:`,
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

export async function startGateway() {
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

export { app, loadBalancer };
