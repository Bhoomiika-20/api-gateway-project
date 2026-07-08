class RoundRobinLoadBalancer {
  constructor(services) {
    this.services = services;
    this.currentIndexes = {
      users: 0,
      orders: 0,
      products: 0
    };
  }

  getNextInstance(serviceName) {
    const instances = this.services[serviceName];

    if (instances.length === 0) {
      throw new Error(`No instances configured for ${serviceName}`);
    }

    const currentIndex = this.currentIndexes[serviceName];
    const selectedInstance = instances[currentIndex];

    this.currentIndexes[serviceName] = (currentIndex + 1) % instances.length;

    return selectedInstance;
  }

  getNextHealthyInstance(serviceName, healthyInstanceNames) {
    const healthyInstances = this.services[serviceName].filter((instance) =>
      healthyInstanceNames.includes(instance.name)
    );

    if (healthyInstances.length === 0) {
      return null;
    }

    const currentIndex = this.currentIndexes[serviceName] % healthyInstances.length;
    const selectedInstance = healthyInstances[currentIndex];

    this.currentIndexes[serviceName] = (currentIndex + 1) % healthyInstances.length;

    return selectedInstance;
  }

  getRegistry() {
    return this.services;
  }
}

module.exports = {
  RoundRobinLoadBalancer
};
