import { useCallback, useMemo } from "react";
import { CapitalFlow, NewCapitalFlow } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

export const useCapitalFlows = (scopeChainId: string) => {
    const load = useCallback(async () => {
        const response = await apiClient.get<CapitalFlow[]>("/capital-flows", {
            params: { scope_chain_id: scopeChainId },
        });
        return response.data;
    }, [scopeChainId]);

    const resource = useApiResource<CapitalFlow[]>({
        initialData: [],
        load,
        deps: [scopeChainId],
    });

    const addFlow = useCallback(
        async (flow: NewCapitalFlow) => {
            await apiClient.post("/capital-flows", flow);
            await resource.reload();
        },
        [resource]
    );

    const removeFlow = useCallback(
        async (id: number) => {
            await apiClient.delete(`/capital-flows/${id}`);
            await resource.reload();
        },
        [resource]
    );

    return useMemo(
        () => ({
            flows: resource.data,
            loading: resource.loading,
            error: resource.error,
            addFlow,
            removeFlow,
        }),
        [addFlow, removeFlow, resource.data, resource.error, resource.loading]
    );
};
