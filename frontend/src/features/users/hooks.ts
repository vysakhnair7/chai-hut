import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { userService } from "@/services/userService";
import type { UserCreate, UserListQuery, UserUpdate } from "@/types/auth";

export function useUsers(query: UserListQuery) {
  return useQuery({
    queryKey: queryKeys.users(query),
    queryFn: () => userService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser(onDone?: () => void) {
  return useApiMutation((body: UserCreate) => userService.create(body), {
    success: (u) => `Created ${u.full_name}`,
    invalidate: [["users"]],
    toastError: false,
    onSuccess: onDone,
  });
}

export function useUpdateUser(id: string, onDone?: () => void) {
  return useApiMutation((body: UserUpdate) => userService.update(id, body), {
    success: "Employee updated",
    invalidate: [["users"]],
    toastError: false,
    onSuccess: onDone,
  });
}

export function useResetPassword(id: string, onDone?: () => void) {
  return useApiMutation((password: string) => userService.resetPassword(id, password), {
    success: "Password reset",
    toastError: false,
    onSuccess: onDone,
  });
}
