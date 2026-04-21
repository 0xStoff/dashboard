import { useCallback, useEffect, useState } from "react";

interface UseApiResourceOptions<T> {
    deps?: readonly unknown[];
    enabled?: boolean;
    initialData: T;
    load: () => Promise<T>;
}

export const useApiResource = <T>({
    deps = [],
    enabled = true,
    initialData,
    load,
}: UseApiResourceOptions<T>) => {
    const [data, setData] = useState<T>(initialData);
    const [loading, setLoading] = useState<boolean>(enabled);
    const [error, setError] = useState<Error | null>(null);

    const reload = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return undefined;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await load();
            setData(result);
            return result;
        } catch (unknownError) {
            const normalizedError =
                unknownError instanceof Error ? unknownError : new Error("Unknown request error");
            setError(normalizedError);
            throw normalizedError;
        } finally {
            setLoading(false);
        }
    }, [enabled, load]);

    useEffect(() => {
        reload().catch((requestError) => {
            console.error(requestError);
        });
    }, [reload, ...deps]);

    return {
        data,
        error,
        loading,
        reload,
        setData,
    };
};
