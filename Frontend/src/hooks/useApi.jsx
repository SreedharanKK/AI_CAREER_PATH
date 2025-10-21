import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const apiFetch = useCallback(async (url, options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const defaultOptions = {
        credentials: 'include',
        headers: {
          ...options.headers,
        },
        ...options,
      };

      if (!(defaultOptions.body instanceof FormData)) {
        defaultOptions.headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(`http://localhost:5000${url}`, defaultOptions);

      if (res.status === 401) {
        console.warn("Session expired. Redirecting to login.");
        navigate('/');
        return null;
      }

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP Error: ${res.status}`);
      }

      return data;
    } catch (err) {
      setError(err.message);
      console.error("API Fetch Error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  return { apiFetch, isLoading, error, setError }; // Expose setError for manual error setting
}