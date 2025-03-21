import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
  withCredentials: true, // This is crucial for sending cookies
});

// Add response interceptor for token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh tokens
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/token/refresh/`, 
          {}, 
          { withCredentials: true }
        );
        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // Redirect to login if refresh fails
        window.location = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;