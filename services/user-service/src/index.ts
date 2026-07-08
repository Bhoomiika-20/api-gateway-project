import express from "express";

const app = express();

const port = Number(process.env.PORT) || 4001;
const serviceName = "user-service";
const instance = process.env.INSTANCE_NAME || `${serviceName}-1`;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    service: serviceName,
    instance,
    status: "UP"
  });
});

app.use("/users", (req, res) => {
  res.json({
    service: serviceName,
    instance,
    method: req.method,
    path: req.originalUrl,
    message: "User request served successfully"
  });
});

app.listen(port, () => {
  console.log(`${instance} running on http://localhost:${port}`);
});
