import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import FullAnalysis from './pages/FullAnalysis';
import ClassificationPage from './pages/ClassificationPage';
import SegmentationPage from './pages/SegmentationPage';
import RAGChat from './pages/RAGChat';
import History from './pages/History';
import About from './pages/About';
import Planner from './pages/Planner';
import { LanguageProvider } from './context/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="analyze" element={<FullAnalysis />} />
            <Route path="classify" element={<ClassificationPage />} />
            <Route path="segment" element={<SegmentationPage />} />
            <Route path="chat" element={<RAGChat />} />
            <Route path="planner" element={<Planner />} />
            <Route path="history" element={<History />} />
            <Route path="about" element={<About />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
