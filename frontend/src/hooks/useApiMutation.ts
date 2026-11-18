import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/errors";

interface Options<TData, TVars> {
  /** Toast shown on success. */
  success?: string | ((data: TData, vars: TVars) => string);
  /** Query keys (prefixes) to refetch after success. */
  invalidate?: QueryKey[];
  onSuccess?: (data: TData, vars: TVars) => void;
  /** Set to false when the caller shows its own error UI (e.g. inline form error). */
  toastError?: boolean;
}

/** useMutation + consistent toasts + cache invalidation, so pages stay small. */
export function useApiMutation<TData, TVars = void>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: Options<TData, TVars> = {},
) {
  const queryClient = useQueryClient();
  const { success, invalidate = [], onSuccess, toastError = true } = options;

  return useMutation<TData, Error, TVars>({
    mutationFn,
    onSuccess: async (data, vars) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (success) toast.success(typeof success === "function" ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (error) => {
      if (toastError) toast.error(getErrorMessage(error));
    },
  });
}
