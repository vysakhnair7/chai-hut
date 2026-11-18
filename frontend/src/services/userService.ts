import type { Message, Page } from "@/types/common";
import type { User, UserCreate, UserListQuery, UserUpdate } from "@/types/auth";
import { apiClient } from "./apiClient";

export const userService = {
  list: (query?: UserListQuery) => apiClient.get<Page<User>>("/users", { query }),
  create: (body: UserCreate) => apiClient.post<User>("/users", body),
  update: (id: string, body: UserUpdate) => apiClient.patch<User>(`/users/${id}`, body),
  resetPassword: (id: string, new_password: string) =>
    apiClient.post<Message>(`/users/${id}/reset-password`, { new_password }),
};
