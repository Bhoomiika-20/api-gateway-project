import { redisClient } from "./redisClient";
import { ServiceInstance, ServiceName } from "./loadBalancer";

type ServiceRegistry = Record<ServiceName, ServiceInstance[]>;

const healthCheckIntervalMs = Number(process.env.HEALTH_CHECK_INTERVAL_MS) || 5000;

function healthKey(instanceName: string) {
  return `service:${instanceName}`;
}

async function checkInstanceHealth(instance: ServiceInstance) {
  try {
    const response = await fetch(`${instance.url}/health`);
    const status = response.ok ? "UP" : "DOWN";

    await redisClient.set(healthKey(instance.name), status, {
      EX: Math.ceil(healthCheckIntervalMs / 1000) * 3
    });
  } catch {
    await redisClient.set(healthKey(instance.name), "DOWN", {
      EX: Math.ceil(healthCheckIntervalMs / 1000) * 3
    });
  }
}

export async function refreshHealthCache(services: ServiceRegistry) {
  const instances = Object.values(services).flat();

  await Promise.all(instances.map((instance) => checkInstanceHealth(instance)));
}

export function startHealthChecks(services: ServiceRegistry) {
  refreshHealthCache(services).catch((error) => {
    console.error("Initial health check failed:", error);
  });

  setInterval(() => {
    refreshHealthCache(services).catch((error) => {
      console.error("Health check failed:", error);
    });
  }, healthCheckIntervalMs);
}

export async function isInstanceHealthy(instanceName: string) {
  const status = await redisClient.get(healthKey(instanceName));
  return status === "UP";
}

export async function getHealthSnapshot(services: ServiceRegistry) {
  const entries = await Promise.all(
    Object.values(services)
      .flat()
      .map(async (instance) => [instance.name, (await redisClient.get(healthKey(instance.name))) || "UNKNOWN"])
  );

  return Object.fromEntries(entries);
}
