# Architecture

```text
Client
  |
  | HTTP requests
  v
API Gateway :3000
  |
  |-- Public routes
  |     |-- /login
  |     |-- /health
  |     |-- /health-cache
  |     |-- /metrics
  |
  |-- Protected routes
        |-- JWT authentication
        |-- Redis IP rate limiting
        |-- Redis health cache lookup
        |-- Round Robin healthy instance selection
        |-- Reverse proxy forwarding
              |
              |-- /users/*    -> user-service-1 :4001 / user-service-2 :4002
              |-- /orders/*   -> order-service-1 :5001 / order-service-2 :5002
              |-- /products/* -> product-service-1 :6001 / product-service-2 :6002

Redis :6379
  |
  |-- rate_limit:<ip> = request count
  |-- service:<instance-name> = UP / DOWN
```

## Request Lifecycle

1. Client sends a request to the API Gateway.
2. Public routes are handled directly by the gateway.
3. Protected routes require a valid JWT.
4. The rate limiter increments an IP-based Redis counter.
5. The gateway reads service health from Redis.
6. The Round Robin load balancer selects one healthy instance.
7. `http-proxy-middleware` forwards the request to the selected service.
8. The gateway logs the request and updates in-memory metrics.

## Failure Behavior

- Invalid or missing JWT returns `401 Unauthorized`.
- Too many requests from the same IP returns `429 Too Many Requests`.
- If Redis cannot be read for rate limiting or health cache, the gateway returns `503 Service Unavailable`.
- If all instances for a service are unhealthy, the gateway returns `503 Service Unavailable`.
- If a selected upstream service fails during proxying, the gateway returns `502 Bad Gateway`.
