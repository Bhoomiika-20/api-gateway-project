const { RoundRobinLoadBalancer } = require("../gateway/src/loadBalancer");

describe("RoundRobinLoadBalancer", () => {
  it("rotates requests across healthy service instances", () => {
    const loadBalancer = new RoundRobinLoadBalancer({
      users: [
        { name: "user-service-1", url: "http://localhost:4001" },
        { name: "user-service-2", url: "http://localhost:4002" }
      ],
      orders: [{ name: "order-service-1", url: "http://localhost:5001" }],
      products: [{ name: "product-service-1", url: "http://localhost:6001" }]
    });

    expect(loadBalancer.getNextHealthyInstance("users", ["user-service-1", "user-service-2"]).name).toBe(
      "user-service-1"
    );
    expect(loadBalancer.getNextHealthyInstance("users", ["user-service-1", "user-service-2"]).name).toBe(
      "user-service-2"
    );
    expect(loadBalancer.getNextHealthyInstance("users", ["user-service-1", "user-service-2"]).name).toBe(
      "user-service-1"
    );
  });

  it("skips unhealthy service instances", () => {
    const loadBalancer = new RoundRobinLoadBalancer({
      users: [
        { name: "user-service-1", url: "http://localhost:4001" },
        { name: "user-service-2", url: "http://localhost:4002" }
      ],
      orders: [{ name: "order-service-1", url: "http://localhost:5001" }],
      products: [{ name: "product-service-1", url: "http://localhost:6001" }]
    });

    expect(loadBalancer.getNextHealthyInstance("users", ["user-service-2"]).name).toBe("user-service-2");
    expect(loadBalancer.getNextHealthyInstance("users", [])).toBeNull();
  });
});
