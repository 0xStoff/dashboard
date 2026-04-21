import { useCallback } from "react";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

export const useAuthStatus = () => {
    const load = useCallback(async () => {
        const response = await apiClient.get<{ success: boolean }>("/auth/check");
        return Boolean(response.data?.success);
    }, []);

    const resource = useApiResource<boolean>({
        initialData: false,
        load,
    });

    return {
        isAuthenticated: resource.data,
        loading: resource.loading,
        error: resource.error,
        refresh: resource.reload,
    };
};
