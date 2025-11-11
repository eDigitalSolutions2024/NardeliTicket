// src/types/express.d.ts
import "express";

export type UserRole = "admin" | "user";
export interface UserPayload {
  id: string;
  email: string;
  role: UserRole;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: UserPayload;
  }
}
