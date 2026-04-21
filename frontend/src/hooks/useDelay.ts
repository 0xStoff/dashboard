import { useEffect, useState } from "react";

const useDelay = (delay: number) => {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setShouldRender(true);
        }, delay);

        return () => clearTimeout(timeout);
    }, [delay]);

    return shouldRender;
};

export default useDelay;
