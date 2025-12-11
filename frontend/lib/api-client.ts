import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// Log API URL in development (helps debug)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    errors?: any[];
  };
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse>) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - clear token
          this.clearToken();
          // Don't redirect here - let the component handle it
          // Components will check auth and redirect appropriately
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('auth_token', token);
  }

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('refresh_token', token);
  }

  async get<T = any>(url: string, config?: any): Promise<T> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url, config);
      if (response.data.success) {
        return response.data.data as T;
      }
      throw new Error(response.data.error?.message || 'Request failed');
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        // Server responded with error
        const errorMessage = error.response.data?.error?.message || error.response.data?.message || error.message || 'Request failed';
        console.error(`API Error [${error.response.status}]:`, errorMessage, 'URL:', `${API_BASE_URL}${url}`);
        throw new Error(errorMessage);
      } else if (error.request) {
        // Request made but no response (network error)
        console.error('Network Error: Unable to reach API at', `${API_BASE_URL}${url}`, error.message);
        throw new Error(`Network Error: Unable to connect to API at ${API_BASE_URL}`);
      } else {
        // Something else happened
        console.error('API Request Error:', error.message);
        throw error;
      }
    }
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error?.message || 'Request failed');
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data, config);
      if (response.data.success) {
        return response.data.data as T;
      }
      throw new Error(response.data.error?.message || 'Request failed');
    } catch (error: any) {
      // Handle axios errors
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || error.response.data?.message || error.message || 'Request failed';
        throw new Error(errorMessage);
      }
      throw error;
    }
  }

  async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error?.message || 'Request failed');
  }

  async delete<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error?.message || 'Request failed');
  }
}

export const apiClient = new ApiClient();
export default apiClient;

