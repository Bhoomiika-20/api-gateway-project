# Resume-Ready API Gateway

A custom API Gateway built from scratch with Node.js, Express, TypeScript, Redis, JWT, Docker, and Jest.

The goal is to demonstrate backend engineering and system design fundamentals without using Nginx, Kong, Traefik, or an existing API Gateway.

## Features

- Reverse proxy routing for `/users`, `/orders`, and `/products`
- Custom Round Robin load balancing
- Two running instances per service
- JWT authentication at the gateway layer
- Redis-backed IP rate limiting
- Redis-backed service health cache
- Health-aware routing that skips unhealthy instances
- Prometheus-style `/metrics` endpoint
- Request logging with selected instance and response time
- Docker Compose setup for local multi-container execution
- Jest + Supertest automated tests

## Tech Stack

- Node.js
- Express.js
- TypeScript
- http-proxy-middleware
- Redis
- JWT
- Docker
- Docker Compose
- Jest
- Supertest

## Architecture

See [architecture.md](./architecture.md).

```text
Client -> API Gateway -> Auth -> Rate Limit -> Health Cache -> Load Balancer -> Microservice
```

Services:

```text
Gateway          :3000
Redis            :6379
user-service-1   :4001
user-service-2   :4002
order-service-1  :5001
order-service-2  :5002
product-service-1:6001
product-service-2:6002
```

## Folder Structure

```text
api-gateway-project/
  gateway/
    src/
      auth.ts
      healthChecker.ts
      index.ts
      loadBalancer.ts
      metrics.ts
      rateLimiter.ts
      redisClient.ts
  services/
    user-service/
    order-service/
    product-service/
  __tests__/
  Dockerfile
  docker-compose.yml
  architecture.md
  README.md
```

## Local Development

Install dependencies:

```bash
npm install
```

Start Redis with Docker:

```bash
docker run --name api-gateway-redis -p 6379:6379 redis:7
```

If the Redis container already exists:

```bash
docker start api-gateway-redis
```

Start services in separate terminals:

```bash
npm run dev:user:1
npm run dev:user:2
npm run dev:order:1
npm run dev:order:2
npm run dev:product:1
npm run dev:product:2
npm run dev:gateway
```

## Docker Compose

If you previously started Redis manually, stop it first so port `6379` is free:

```bash
docker stop api-gateway-redis
```

Run the whole system:

```bash
docker compose up --build
```

Stop containers:

```bash
docker compose down
```

Troubleshooting:

- If port `6379` is already in use, stop the manually started Redis container with `docker stop api-gateway-redis`.
- If Docker shows `Access is denied` for `.docker/config.json` or `buildx`, close Docker Desktop and VS Code, then reopen both from the same Windows user account.

The client should only call the gateway:

```text
http://localhost:3000
```

## API Endpoints

Public:

```text
GET /login
GET /health
GET /health-cache
GET /metrics
```

Protected:

```text
GET /users/profile
GET /orders/123
GET /products/abc
```

## JWT Authentication

Get a demo token:

```bash
curl.exe http://localhost:3000/login
```

Use the token:

```bash
curl.exe -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/users/profile
```

Without a token, protected routes return:

```text
401 Unauthorized
```

## Rate Limiting

Default limit:

```text
20 requests per 60 seconds per IP
```

Redis key example:

```text
rate_limit:127.0.0.1
```

When the limit is exceeded:

```text
429 Too Many Requests
```

## Health Checks

Each service exposes:

```text
GET /health
```

The gateway checks services every few seconds and stores health in Redis:

```text
service:user-service-1 = UP
service:user-service-2 = DOWN
```

Check cached health:

```bash
curl.exe http://localhost:3000/health-cache
```

## Metrics

Check metrics:

```bash
curl.exe http://localhost:3000/metrics
```

Metric names:

```text
gateway_requests_total
gateway_request_duration_ms_sum
gateway_request_duration_ms_count
gateway_requests_by_status_total
gateway_requests_by_route_total
gateway_requests_by_service_total
gateway_rate_limited_total
gateway_upstream_errors_total
gateway_service_health_status
```

## Testing

Run automated tests:

```bash
npm test
```

Run TypeScript build:

```bash
npm run build
```

Current test coverage includes:

- JWT token creation
- Missing token rejection
- Metrics endpoint output
- Round Robin rotation
- Unhealthy instance skipping

## Environment Variables

```text
GATEWAY_PORT=3000
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-me
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=20
HEALTH_CHECK_INTERVAL_MS=5000
USER_SERVICE_1_URL=http://localhost:4001
USER_SERVICE_2_URL=http://localhost:4002
ORDER_SERVICE_1_URL=http://localhost:5001
ORDER_SERVICE_2_URL=http://localhost:5002
PRODUCT_SERVICE_1_URL=http://localhost:6001
PRODUCT_SERVICE_2_URL=http://localhost:6002
```

## Resume Bullet Points

- Built a custom API Gateway using Node.js, Express, and TypeScript to route traffic across user, order, and product microservices.
- Implemented reverse proxy routing with custom Round Robin load balancing across multiple service instances.
- Added JWT authentication at the gateway layer to centralize access control for protected service routes.
- Integrated Redis for IP-based rate limiting and service health caching.
- Implemented health-aware routing to skip unhealthy service instances and return `503` when no healthy upstreams are available.
- Exposed Prometheus-style gateway metrics for request volume, latency, status codes, rate limits, upstream errors, and service health.
- Containerized the gateway, Redis, and microservices using Docker Compose for one-command local execution.
- Added Jest and Supertest automated tests covering authentication, metrics, load balancing, and failover behavior.

## Interview Questions

### What is an API Gateway?

An API Gateway is a single entry point between clients and backend services. It handles routing, authentication, rate limiting, logging, metrics, and service selection before forwarding requests.

### Reverse Proxy vs Forward Proxy

A forward proxy hides the client from the server. A reverse proxy hides backend servers from the client. This project uses a reverse proxy because clients call the gateway, and the gateway forwards requests to internal services.

### Why use an API Gateway?

It centralizes cross-cutting concerns such as authentication, rate limiting, logging, metrics, and routing so every microservice does not need to implement the same logic.

### Why Load Balancing?

Load balancing spreads traffic across multiple service instances so one instance does not receive all requests.

### Why Round Robin?

Round Robin is simple and predictable. It sends requests to instances in turn: instance 1, instance 2, then back to instance 1.

### Why Redis?

Redis is fast and works well for temporary data such as request counts and service health states.

### Why Docker?

Docker gives every service a consistent runtime environment and lets the full system run locally with one command.

### Why Health Checks?

Health checks prevent the gateway from sending traffic to services that are down or unhealthy.

### How does JWT Authentication work?

The gateway signs a token with a secret on `/login`. Protected routes require `Authorization: Bearer <token>`. The gateway verifies the token before proxying the request.

### What are Prometheus Metrics?

Prometheus metrics are plain-text measurements that monitoring systems can scrape. They help track request count, latency, status codes, errors, and service health.

## Future Improvements

- Sliding-window rate limiting
- Persistent metrics store
- Centralized structured logs
- Circuit breaker behavior
- Request ID propagation
- GitHub Actions CI pipeline
- More integration tests using real Redis and Docker Compose
