import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_TIMEOUT = 5000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
});

export const trainModel = async (payload) => {
  const response = await api.post('/train', payload, { timeout: 60000 });
  return response.data;
};

export const sendTriageEmails = async (submissionId) => {
  const response = await api.post('/api/triage/send-emails', { submissionId }, { timeout: 30000 });
  return response.data;
};

export const sendLetterOfIntent = async (payload) => {
  const response = await api.post('/api/triage/send-letter', payload, { timeout: 30000 });
  return response.data;
};

export const fetchPropertyResult = async (submissionId) => {
  const response = await api.get(`/api/triage/property/${submissionId}`);
  return response.data;
};

export const fetchTriageProperties = async () => {
  const response = await api.get('/api/triage/properties');
  return response.data;
};
