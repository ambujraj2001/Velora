import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './index.css';
import Home from './pages/Home';
import Conversation from './pages/Conversation';
import Dashboards from './pages/Dashboards';
import Login from './pages/Login';
import DataSources from './pages/DataSources';
import NewConnection from './pages/NewConnection';
import ChatHistory from './pages/ChatHistory';
import HelpSupport from './pages/HelpSupport';
import DataContext from './pages/DataContext';
import DataContextConnection from './pages/DataContextConnection';
import DataContextTable from './pages/DataContextTable';
import Settings from './pages/Settings';

import { api } from './lib/appConfig';

function App() {
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data?.user || null);
      } catch (err) {
        console.error('Auth error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#F06543]/20 border-t-[#F06543]" />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />

        {/* Protected Routes */}
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/c/:id" element={user ? <Conversation /> : <Navigate to="/login" />} />
        <Route path="/data-sources" element={user ? <DataSources /> : <Navigate to="/login" />} />
        <Route
          path="/data-sources/new"
          element={user ? <NewConnection /> : <Navigate to="/login" />}
        />
        <Route path="/history" element={user ? <ChatHistory /> : <Navigate to="/login" />} />

        <Route path="/dashboards" element={user ? <Dashboards /> : <Navigate to="/login" />} />
        <Route path="/data-context" element={user ? <DataContext /> : <Navigate to="/login" />} />
        <Route path="/data-context/:connId" element={user ? <DataContextConnection /> : <Navigate to="/login" />} />
        <Route path="/data-context/:connId/tables/:tableName" element={user ? <DataContextTable /> : <Navigate to="/login" />} />
        <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
        <Route path="/help" element={user ? <HelpSupport /> : <Navigate to="/login" />} />

        {/* Fallback to login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
