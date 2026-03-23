import { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RequestPage from './pages/RequestPage.jsx';
import DJPanel from './pages/DJPanel.jsx';
import DisplayPage from './pages/DisplayPage.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#ff4444', fontFamily: 'monospace', background: '#111', minHeight: '100vh' }}>
          <h2 style={{ color: '#fff' }}>Bir hata oluştu</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, marginTop: 20 }}>
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 20px', fontSize: 16, cursor: 'pointer' }}>
            Sayfayı Yenile
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/request/:slug" element={<RequestPage />} />
          <Route path="/dj" element={<DJPanel />} />
          <Route path="/dj/:slug" element={<DJPanel />} />
          <Route path="/display/:slug" element={<DisplayPage />} />
          <Route path="/reji/:slug" element={<DisplayPage rejiMode />} />
          <Route path="*" element={<Navigate to="/dj" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
