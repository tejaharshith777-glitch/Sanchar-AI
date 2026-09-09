import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import axios from 'axios'
import { API_BASE } from './config'

axios.defaults.baseURL = API_BASE;

// Add a request interceptor to allow tracking retry attempts
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    // If we don't have config or it's not a retryable error, reject
    if (!config || !(!error.response || error.response.status >= 500)) {
      return Promise.reject(error);
    }
    
    // Skip retrying if caller handles its own retries, or health endpoint
    if (config.skipRetry || (config.url && config.url.includes('/api/health'))) {
      return Promise.reject(error);
    }

    // Never blind-retry mutating requests unless they carry an Idempotency-Key:
    // retrying e.g. pilot signups on a 500 would create duplicates server-side.
    const method = (config.method || 'get').toLowerCase();
    const headers: any = config.headers;
    const hasIdemKey = !!(headers && (typeof headers.get === 'function'
      ? (headers.get('Idempotency-Key') || headers.get('idempotency-key'))
      : (headers['Idempotency-Key'] || headers['idempotency-key'])));
    if ((method === 'post' || method === 'put' || method === 'patch' || method === 'delete') && !hasIdemKey) {
      return Promise.reject(error);
    }

    config.retryAttempt = config.retryAttempt || 0;

    if (config.retryAttempt < 3) {
      config.retryAttempt += 1;
      
      const delays = [3000, 8000, 15000];
      const delay = delays[config.retryAttempt - 1] || 20000;
      
      window.dispatchEvent(new CustomEvent('axios-retry-start', { 
        detail: { attempt: config.retryAttempt, maxRetries: 3 } 
      }));

      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        const res = await axios(config);
        window.dispatchEvent(new CustomEvent('axios-retry-end', { detail: { success: true } }));
        return res;
      } catch (e) {
        // Let the interceptor handle the next iteration
        return Promise.reject(e);
      }
    }
    
    window.dispatchEvent(new CustomEvent('axios-retry-end', { detail: { success: false } }));
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
