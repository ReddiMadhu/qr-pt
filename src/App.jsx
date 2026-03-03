import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import AdminLayout from './components/AdminLayout';
import AdminConfigPage from './pages/AdminConfigPage';
import DataUploadPage from './pages/DataUploadPage';

import PipelineAnimation from './pages/PipelineAnimation';
import PropertyDetail from './pages/PropertyDetail';
import TriagePage from './pages/TriagePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AdminLayout><AdminConfigPage /></AdminLayout>} />
        <Route path="/upload" element={<AdminLayout><DataUploadPage /></AdminLayout>} />

        <Route path="/processing" element={<AdminLayout><PipelineAnimation /></AdminLayout>} />
        <Route path="/property/:id" element={<AdminLayout><PropertyDetail /></AdminLayout>} />
        <Route path="/triage" element={<AdminLayout><TriagePage /></AdminLayout>} />
      </Routes>
    </Router>
  );
}

export default App;
