import axios from "axios";
import toast from "react-hot-toast";
import { BACKEND_URL } from "services/backendUrl";

const apiClient = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
});

const shouldSkipToast = (error) => {
  const status = error.response?.status;
  return status === 401 || status === 403;
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!shouldSkipToast(error)) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        "Something went wrong. Please try again.";
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export const attachToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export default apiClient;
