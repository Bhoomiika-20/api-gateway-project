import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

export function createDemoToken() {
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

export function authenticateJwt(req: Request, res: Response, next: NextFunction) {
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
