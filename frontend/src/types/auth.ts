import type { ActiveStatus, IsoDateTime } from "./common";

export type Role = "owner" | "manager" | "cashier";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  status: ActiveStatus;
  created_at: IsoDateTime;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserCreate {
  username: string;
  password: string;
  full_name: string;
  role: Role;
}

export interface UserUpdate {
  full_name?: string;
  role?: Role;
  status?: ActiveStatus;
}

export interface UserListQuery {
  role?: Role;
  status?: ActiveStatus;
  limit?: number;
  offset?: number;
}
