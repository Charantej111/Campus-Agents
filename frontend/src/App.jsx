import React, { useState, useEffect } from "react";
import axios from "axios";
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from "./context/ToastContext";
import LoginPage from './pages/LoginPage';
import WorkspaceSelector from './components/WorkspaceSelector';
import WorkspaceManager from './components/WorkspaceManager';
import JDInput from "./components/JDInput";
import ResultsView from "./components/ResultsView";
import HistorySidebar from "./components/HistorySidebar";
import SchedulingAgentView from "./components/SchedulingAgentView";
import AllocationAgentView from "./components/AllocationAgentView";
import { Briefcase, Calendar, Settings, LogOut, Layers, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

// API config
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AuthenticatedApp = () => {
  const { user, workspace, selectWorkspace, logout } = useAuth();
  const [currentView, setCurrentView] = useState('placement'); // 'placement' | 'scheduling' | 'allocation' | 'manage'

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // History State
  const [history, setHistory] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch History on Mount
  useEffect(() => {
    if (workspace) fetchHistory();
  }, [workspace]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  const handleJDSubmit = async (jdText) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/generate`, {
        job_description: jdText,
      });
      setResult(response.data);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to generate interview plan.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistory = (item) => {
    setResult(item);
    setError(null);
    setCurrentView('placement');
  };

  if (!workspace) return <WorkspaceSelector />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <HistorySidebar
        history={history}
        onSelect={handleSelectHistory}
        isOpen={isSidebarOpen}
        toggleOpen={setIsSidebarOpen}
      />

      <div className={`container mx-auto px-4 py-8 flex-grow max-w-7xl transition-all duration-300 ${isSidebarOpen ? "md:pl-80" : ""}`}>
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl"
            >
              <Layers className="w-6 h-6 text-indigo-400" />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-2xl tracking-tight text-white">Campus Agents</span>
              <span className="text-xs text-white/40 font-mono">{workspace.name}</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex glass-card p-1.5 rounded-xl border border-white/10 backdrop-blur-sm">
            <button
              onClick={() => setCurrentView('placement')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${currentView === 'placement' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <Briefcase className="w-4 h-4" />
              Placement
            </button>
            <button
              onClick={() => setCurrentView('scheduling')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${currentView === 'scheduling' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <Calendar className="w-4 h-4" />
              Scheduling
            </button>
            <button
              onClick={() => setCurrentView('allocation')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${currentView === 'allocation' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <Layers className="w-4 h-4" />
              Allocation
            </button>
            <button
              onClick={() => setCurrentView('manage')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${currentView === 'manage' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <Settings className="w-4 h-4" />
              Manage
            </button>

          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => selectWorkspace(null)} className="p-2.5 glass-card rounded-lg text-white/60 hover:text-white hover:border-indigo-500/50 transition-all" title="Switch Workspace">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={logout} className="p-2.5 glass-card rounded-lg text-white/60 hover:text-red-400 hover:border-red-500/50 transition-all" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="w-full">
          {currentView === 'placement' && (
            <>
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                  <span className="font-bold">Error:</span> {error}
                </div>
              )}
              {!result ? (
                <JDInput onSubmit={handleJDSubmit} loading={loading} />
              ) : (
                <ResultsView result={result} onBack={() => setResult(null)} />
              )}
            </>
          )}
          {currentView === 'scheduling' && <SchedulingAgentView />}
          {currentView === 'allocation' && <AllocationAgentView />}
          {currentView === 'manage' && <WorkspaceManager />}
        </main>
      </div>

      <footer className={`py-6 text-center text-xs text-white/30 border-t border-white/10 mt-12 transition-all duration-300 ${isSidebarOpen ? "md:pl-80" : ""}`}>
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3" />
          <span>Powered by LangGraph & Gemini</span>
        </div>
      </footer>
    </div>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-white">Loading...</div>;
  if (!user) return <LoginPage />;
  return <AuthenticatedApp />;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
