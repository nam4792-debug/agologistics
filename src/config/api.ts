// API Configuration
// This file manages the API URL for different environments

// In production (Render), use the deployed server URL
// In development, use localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export { API_BASE_URL };
