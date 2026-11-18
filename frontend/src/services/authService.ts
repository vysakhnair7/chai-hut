import type { ChangePasswordRequest, LoginRequest, TokenResponse, User } from "@/types/auth";
import type { Message } from "@/types/common";
import { apiClient } from "./apiClient";

export const authService = {
  login: (body: LoginRequest) => apiClient.post<TokenResponse>("/auth/login", body, { auth: false }),
  me: () => apiClient.get<User>("/auth/me"),
  changePassword: (body: ChangePasswordRequest) =>
    apiClient.post<Message>("/auth/change-password", body),
};
