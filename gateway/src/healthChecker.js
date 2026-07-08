const { redisClient } = require("./redisClient");

const healthCheckIntervalMs = Number(process.env.HEALTH_CHECK_INTERVAL_MS) || 5000;

function healthKey(instanceName) {
  return `service:${instanceName}`;
}

async function checkInstanceHealth(instance) {
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

async function refreshHealthCache(services) {
  const instances = Object.values(services).flat();

  await Promise.all(instances.map((instance) => checkInstanceHealth(instance)));
}

function startHealthChecks(services) {
  refreshHealthCache(services).catch((error) => {
    console.error("Initial health check failed:", error);
  });

  setInterval(() => {
    refreshHealthCache(services).catch((error) => {
      console.error("Health check failed:", error);
    });
  }, healthCheckIntervalMs);
}

async function isInstanceHealthy(instanceName) {
  const status = await redisClient.get(healthKey(instanceName));
  return status === "UP";
}

async function getHealthSnapshot(services) {
  const entries = await Promise.all(
    Object.values(services)
      .flat()
      .map(async (instance) => [instance.name, (await redisClient.get(healthKey(instance.name))) || "UNKNOWN"])
  );

  return Object.fromEntries(entries);
}

module.exports = {
  refreshHealthCache,
  startHealthChecks,
  isInstanceHealthy,
  getHealthSnapshot
};
