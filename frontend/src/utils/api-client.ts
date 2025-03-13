import axios from "axios";

const apiClient = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL,
    headers: { "Content-Type": "application/json" },
    withCredentials: true, // 🔴 Ensures cookies are included in all requests
});

export default apiClient;