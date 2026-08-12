import axios from 'axios';

const responseCache = new Map();
const pendingRequests = new Map();

const cacheKey = (endpoint, params) => `${endpoint}?${new URLSearchParams(
    Object.entries(params).sort(([left], [right]) => left.localeCompare(right))
).toString()}`;

const fetchDebankData = async (endpoint, params = {}, options = {}) => {
    const ttlMs = Number(options.ttlMs || 0);
    const key = cacheKey(endpoint, params);
    const cached = responseCache.get(key);
    if (!options.force && ttlMs > 0 && cached && Date.now() - cached.savedAt < ttlMs) {
        return cached.value;
    }
    if (pendingRequests.has(key)) return pendingRequests.get(key);

    const request = (async () => {
    try {
        const response = await axios.get(`https://pro-openapi.debank.com/v1${endpoint}`, {
            headers: {
                Accept: 'application/json', AccessKey: process.env.RABBY_ACCESS_KEY
            },
            params
        });
        if (ttlMs > 0) responseCache.set(key, { value: response.data, savedAt: Date.now() });
        return response.data;
    } catch (error) {
        console.error("Error fetching DeBank data:", error.response?.status || error.code, error.message);
        throw error;
    } finally {
        pendingRequests.delete(key);
    }
    })();

    pendingRequests.set(key, request);
    return request;
};

export const clearDebankCache = () => responseCache.clear();

export default fetchDebankData;
