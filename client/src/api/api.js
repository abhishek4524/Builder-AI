import axios from "axios";
import { toast } from "react-hot-toast";

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || "",
    withCredentials: true,
});

// Request interceptor to attach Authorization Bearer token & ngrok headers
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Prevents ngrok free-tier browser interstitial warning page
        config.headers["ngrok-skip-browser-warning"] = "true";
        return config;
    },
    (error) => Promise.reject(error)
);

let onOutOfCreditsCallback = null;

export function setOnOutOfCreditsHandler(handler) {
    onOutOfCreditsCallback = handler;
}

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 402) {
            const data = error.response.data || {};
            if (onOutOfCreditsCallback) {
                onOutOfCreditsCallback(data);
            }
            window.dispatchEvent(new CustomEvent("out_of_credits", { detail: data }));
        } else if (error?.response?.status === 429) {
            const data = error.response.data || {};
            const retryAfter = data.retryAfter;
            const message = retryAfter
                ? `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`
                : data.message || "Too many requests. Please slow down.";
            toast.error(message);
        } else if (error?.response?.status === 409) {
            const data = error.response.data || {};
            if (data.code === "GENERATION_IN_PROGRESS") {
                toast.error(data.message || "A website generation is already in progress.");
            }
        } else if (error?.response?.status === 403) {
            const data = error.response.data || {};
            if (data.code === "EMAIL_NOT_VERIFIED") {
                window.dispatchEvent(new CustomEvent("email_not_verified", { detail: data }));
            }
        }
        return Promise.reject(error);
    }
);

export default api;
