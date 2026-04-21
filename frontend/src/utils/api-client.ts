import axios from "axios";
import { env } from "../config/env";

const apiClient = axios.create({
    baseURL: env.apiBaseUrl,
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
});

export default apiClient;
