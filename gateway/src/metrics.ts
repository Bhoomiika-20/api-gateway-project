import { Request } from "express";

type CounterMap = Record<string, number>;

const metrics = {
  totalRequests: 0,
  requestDurationCount: 0,
  requestDurationSumMs: 0,
  requestsByStatus: {} as CounterMap,
  requestsByRoute: {} as CounterMap,
  requestsByService: {} as CounterMap,
  upstreamErrors: 0,
  rateLimitedRequests: 0
};

function increment(map: CounterMap, key: string) {
  map[key] = (map[key] || 0) + 1;
}

function getRouteLabel(req: Request) {
  const firstSegment = req.path.split("/").filter(Boolean)[0];
  return firstSegment ? `/${firstSegment}` : "/";
}

export function recordRequest(req: Request, statusCode: number, durationMs: number, serviceName = "gateway") {
  metrics.totalRequests += 1;
  metrics.requestDurationCount += 1;
  metrics.requestDurationSumMs += durationMs;

  increment(metrics.requestsByStatus, String(statusCode));
  increment(metrics.requestsByRoute, getRouteLabel(req));
  increment(metrics.requestsByService, serviceName);
}

export function recordUpstreamError() {
  metrics.upstreamErrors += 1;
}

export function recordRateLimitedRequest() {
  metrics.rateLimitedRequests += 1;
}

export function renderMetrics(healthSnapshot: Record<string, string>) {
  const lines = [
    "# HELP gateway_requests_total Total HTTP requests handled by the gateway",
    "# TYPE gateway_requests_total counter",
    `gateway_requests_total ${metrics.totalRequests}`,
    "",
    "# HELP gateway_request_duration_ms_sum Total request duration in milliseconds",
    "# TYPE gateway_request_duration_ms_sum counter",
    `gateway_request_duration_ms_sum ${metrics.requestDurationSumMs}`,
    `gateway_request_duration_ms_count ${metrics.requestDurationCount}`,
    "",
    "# HELP gateway_requests_by_status_total Requests grouped by HTTP status code",
    "# TYPE gateway_requests_by_status_total counter",
    ...Object.entries(metrics.requestsByStatus).map(
      ([status, count]) => `gateway_requests_by_status_total{status="${status}"} ${count}`
    ),
    "",
    "# HELP gateway_requests_by_route_total Requests grouped by route prefix",
    "# TYPE gateway_requests_by_route_total counter",
    ...Object.entries(metrics.requestsByRoute).map(
      ([route, count]) => `gateway_requests_by_route_total{route="${route}"} ${count}`
    ),
    "",
    "# HELP gateway_requests_by_service_total Requests grouped by selected service instance",
    "# TYPE gateway_requests_by_service_total counter",
    ...Object.entries(metrics.requestsByService).map(
      ([service, count]) => `gateway_requests_by_service_total{service="${service}"} ${count}`
    ),
    "",
    "# HELP gateway_rate_limited_total Requests rejected by the rate limiter",
    "# TYPE gateway_rate_limited_total counter",
    `gateway_rate_limited_total ${metrics.rateLimitedRequests}`,
    "",
    "# HELP gateway_upstream_errors_total Errors while proxying to upstream services",
    "# TYPE gateway_upstream_errors_total counter",
    `gateway_upstream_errors_total ${metrics.upstreamErrors}`,
    "",
    "# HELP gateway_service_health_status Service health from Redis cache. 1 means UP, 0 means DOWN or UNKNOWN",
    "# TYPE gateway_service_health_status gauge",
    ...Object.entries(healthSnapshot).map(
      ([service, status]) => `gateway_service_health_status{service="${service}",status="${status}"} ${status === "UP" ? 1 : 0}`
    )
  ];

  return `${lines.join("\n")}\n`;
}

export function resetMetricsForTests() {
  metrics.totalRequests = 0;
  metrics.requestDurationCount = 0;
  metrics.requestDurationSumMs = 0;
  metrics.requestsByStatus = {};
  metrics.requestsByRoute = {};
  metrics.requestsByService = {};
  metrics.upstreamErrors = 0;
  metrics.rateLimitedRequests = 0;
}
