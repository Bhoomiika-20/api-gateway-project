const request = require("supertest");
const { app } = require("../gateway/src/index");
const { resetMetricsForTests } = require("../gateway/src/metrics");

jest.mock("../gateway/src/healthChecker", () => ({
  getHealthSnapshot: jest.fn(async () => ({
    "user-service-1": "UP",
    "user-service-2": "UP"
  })),
  isInstanceHealthy: jest.fn(async () => true),
  startHealthChecks: jest.fn()
}));

describe("API Gateway public routes", () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it("returns a JWT from /login", async () => {
    const response = await request(app).get("/login").expect(200);

    expect(response.body.tokenType).toBe("Bearer");
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("blocks protected routes when Authorization header is missing", async () => {
    const response = await request(app).get("/users/profile").expect(401);

    expect(response.body.error).toBe("Unauthorized");
  });

  it("returns Prometheus-style metrics text", async () => {
    const response = await request(app).get("/metrics").expect(200);

    expect(response.text).toContain("gateway_requests_total");
    expect(response.text).toContain("gateway_service_health_status");
  });
});
