import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RequestPage from './pages/RequestPage.jsx';
import DJPanel from './pages/DJPanel.jsx';
import DisplayPage from './pages/DisplayPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/request/:slug" element={<RequestPage />} />
        <Route path="/dj" element={<DJPanel />} />
        <Route path="/dj/:slug" element={<DJPanel />} />
        <Route path="/display/:slug" element={<DisplayPage />} />
        <Route path="*" element={<Navigate to="/dj" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
