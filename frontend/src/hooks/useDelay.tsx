import { useEffect, useState } from "react";

/**
 * Hook that delays rendering until a specified time has passed
 * @param delay - Time in milliseconds to delay
 * @returns boolean indicating whether the delay period has passed
 */
export const useDelay = (delay: number): boolean => {
    const [shouldRender, setShouldRender] = useState<boolean>(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setShouldRender(true);
        }, delay);
        
        return () => clearTimeout(timeout);
    }, [delay]);

    return shouldRender;
};