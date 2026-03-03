import axios from 'axios';
import { mockProperties, mockDecisions, mockShapDrivers, mockResultsNew } from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_TIMEOUT = 5000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
});

export const fetchProperties = async () => {
  try {
    const response = await api.get('/api/properties');
    return response.data;
  } catch (error) {
    console.warn('API call failed for properties, using fallback data:', error.message);
    return mockProperties;
  }
};

export const fetchDecisions = async () => {
  try {
    const response = await api.get('/api/decisions');
    return response.data;
  } catch (error) {
    console.warn('API call failed for decisions, using fallback data:', error.message);
    return mockDecisions;
  }
};

export const fetchShapDrivers = async () => {
  try {
    const response = await api.get('/api/shap-drivers');
    return response.data;
  } catch (error) {
    console.warn('API call failed for SHAP drivers, using fallback data:', error.message);
    return mockShapDrivers;
  }
};

export const pollSubmission = async () => {
  try {
    const response = await api.get('/api/submissions/latest');
    return response.data;
  } catch (error) {
    console.warn('Polling failed:', error.message);
    return null;
  }
};

export const submitDecision = async (payload) => {
  const response = await api.post('/api/submissions', payload);
  return response.data;
};

export const triggerProcess = async (submissionId) => {
  const response = await api.post('/api/process', { submissionId });
  return response.data;
};

export const trainModel = async (payload) => {
  const response = await api.post('/train', payload, { timeout: 60000 });
  return response.data;
};

export const fetchResults = async (submissionId) => {
  try {
    const response = await api.get(`/api/results/${submissionId}`);
    return response.data;
  } catch (error) {
    console.warn('API call failed for results, using fallback data:', error.message);
    return mockResultsNew;
  }
};

export const fetchLeaderboard = async () => {
  try {
    const response = await api.get('/api/leaderboard');
    return response.data;
  } catch (error) {
    console.warn('Leaderboard fetch failed:', error.message);
    return [];
  }
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

export const predictTriage = async (payload) => {
  // Use a longer timeout for file uploads and model inference
  const response = await api.post('/api/triage/properties', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  });
  return response.data;
};
