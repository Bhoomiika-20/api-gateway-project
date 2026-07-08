const jwt = require("jsonwebtoken");

const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

function createDemoToken() {
  return jwt.sign(
    {
      sub: "demo-user-1",
      role: "customer"
    },
    jwtSecret,
    {
      expiresIn: "1h"
    }
  );
}

function authenticateJwt(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing Authorization header"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token"
    });
  }
}

module.exports = {
  createDemoToken,
  authenticateJwt
};
