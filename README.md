# Resume-Ready API Gateway

This project builds a custom API Gateway from scratch over 5 days.

## Day 1 Scope

Day 1 creates the foundation:

- API Gateway on port `3000`
- User service on port `4001`
- Order service on port `5001`
- Product service on port `6001`
- Reverse proxy routes:
  - `/users/*` -> user service
  - `/orders/*` -> order service
  - `/products/*` -> product service

## How to Run Day 1

Install dependencies:

```bash
npm install
```

Start each process in a separate terminal:

```bash
npm run dev:user
npm run dev:order
npm run dev:product
npm run dev:gateway
```

Then test through the gateway:

```bash
curl http://localhost:3000/users/profile
curl http://localhost:3000/orders/123
curl http://localhost:3000/products/abc
```

## What You Should Notice

You call only the gateway on port `3000`.

The gateway forwards the request to the correct internal service based on the URL prefix.

For example:

```text
Client -> Gateway /users/profile -> User Service
```

This is the first building block of an API Gateway.

## Day 2 Scope

Day 2 adds a custom Round Robin Load Balancer.

Each service can now run as two instances:

- `user-service-1` on port `4001`
- `user-service-2` on port `4002`
- `order-service-1` on port `5001`
- `order-service-2` on port `5002`
- `product-service-1` on port `6001`
- `product-service-2` on port `6002`

The gateway rotates requests across instances.

Example:

```text
GET /users/profile -> user-service-1
GET /users/profile -> user-service-2
GET /users/profile -> user-service-1
```

## How to Run Day 2

Start each process in a separate terminal:

```bash
npm run dev:user:1
npm run dev:user:2
npm run dev:order:1
npm run dev:order:2
npm run dev:product:1
npm run dev:product:2
npm run dev:gateway
```

Then call the gateway multiple times:

```bash
curl.exe http://localhost:3000/users/profile
curl.exe http://localhost:3000/users/profile
curl.exe http://localhost:3000/users/profile
```

You should see the `instance` field alternate between `user-service-1` and `user-service-2`.

## Day 2 Concept

Load balancing means spreading traffic across multiple running copies of the same service.

Round Robin is the simplest strategy: choose instance 1, then instance 2, then instance 1 again, and keep repeating.

## Day 3 Scope

Day 3 adds three gateway responsibilities:

- Redis-based rate limiting
- JWT authentication
- Redis health cache

## Day 3 Concept

Rate limiting protects the gateway from too many requests from the same IP.

JWT authentication protects private routes. The client first calls `/login`, gets a token, and then sends that token in the `Authorization` header.

Health cache lets the gateway avoid unhealthy service instances. The gateway checks each service's `/health` route every few seconds and stores `UP` or `DOWN` in Redis.

## How to Run Day 3

Start Redis first. If Redis is installed locally:

```bash
redis-server
```

If you have Docker:

```bash
docker run --name api-gateway-redis -p 6379:6379 redis:7
```

Then start service instances and the gateway:

```bash
npm run dev:user:1
npm run dev:user:2
npm run dev:order:1
npm run dev:order:2
npm run dev:product:1
npm run dev:product:2
npm run dev:gateway
```

Get a demo token:

```bash
curl.exe http://localhost:3000/login
```

Use that token on protected routes:

```bash
curl.exe -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:3000/users/profile
```

Check cached service health:

```bash
curl.exe http://localhost:3000/health-cache
```

If you call a protected route without a token, the gateway returns `401 Unauthorized`.

If you send too many requests within one minute, the gateway returns `429 Too Many Requests`.
