import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Calendar, Users, AlertTriangle, CheckCircle, GraduationCap, LayoutGrid, List as ListIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import SeatVisualization from './SeatVisualization';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const ExamAgentView = () => {
    const { workspace } = useAuth();
    const [request, setRequest] = useState("Schedule upcoming exams");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('visual'); // Default to visual as per request preference
    const [buildings, setBuildings] = useState([]);

    // Fetch initial plan and master data
    useEffect(() => {
        if (workspace) {
            fetchExamPlan();
            fetchBuildings();
        }
    }, [workspace]);

    const fetchExamPlan = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/exam_plan`);
            // Only set data if verify it's a valid plan (has rows)
            if (res.data && (res.data.timetable.length > 0 || res.data.allocations.length > 0)) {
                setData(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch existing plan", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBuildings = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/buildings`);
            setBuildings(res.data);
        } catch (err) {
            console.error("Failed to fetch buildings", err);
        }
    };

    const handleSchedule = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.post(`${API_URL}/exam/schedule`, {
                request_text: request,
                workspace_id: workspace.id
            });
            setData(res.data);
            if (res.data.status === 'complete') {
                setActiveTab('visual');
            }
        } catch (err) {
            setError(err.response?.data?.detail || "Scheduling failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            {/* Hero/Input Section */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8 rounded-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <Calendar className="w-6 h-6 text-blue-400" />
                        </div>
                        <h2 className="text-3xl font-display font-bold text-white">
                            Exam Scheduler Agent
                        </h2>
                    </div>
                    <p className="text-base text-white/60 mb-6 max-w-2xl">
                        AI-powered coordination agent for automated timetable generation and intelligent seat allocation.
                    </p>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={request}
                            onChange={(e) => setRequest(e.target.value)}
                            className="flex-1 glass-card border border-white/20 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-white/30"
                            placeholder="Enter scheduling request (e.g., 'Schedule exams for CS dept')..."
                        />
                        <motion.button
                            onClick={handleSchedule}
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/30"
                        >
                            {loading ? "Scheduling..." : "Run Agent"}
                        </motion.button>
                    </div>
                </div>
            </motion.div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {data && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    {/* Status Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard
                            label="Status"
                            value={data.status}
                            icon={data.status === 'complete' ? <CheckCircle className="text-green-400" /> : <AlertTriangle className="text-yellow-400" />}
                        />
                        <StatCard
                            label="Conflicts"
                            value={data.conflicts.length}
                            color={data.conflicts.length > 0 ? "text-red-400" : "text-green-400"}
                        />
                        <StatCard
                            label="Allocations"
                            value={data.allocations.length}
                            icon={<Users className="text-blue-400" />}
                        />
                    </div>

                    {/* Conflicts Alert */}
                    {data.conflicts.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="glass-card border border-orange-500/30 p-5 rounded-2xl"
                        >
                            <h3 className="font-display font-bold text-orange-400 mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> Conflicts Detected
                            </h3>
                            <ul className="list-disc list-inside space-y-1.5 text-sm text-orange-300/80">
                                {data.conflicts.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </motion.div>
                    )}

                    {/* Tabs */}
                    <div className="border-b border-white/10 flex gap-6">
                        <TabButton active={activeTab === 'timetable'} onClick={() => setActiveTab('timetable')}>
                            <ListIcon className="w-4 h-4 mr-2" /> Timetable
                        </TabButton>
                        <TabButton active={activeTab === 'allocations'} onClick={() => setActiveTab('allocations')}>
                            <ListIcon className="w-4 h-4 mr-2" /> List View
                        </TabButton>
                        <TabButton active={activeTab === 'visual'} onClick={() => setActiveTab('visual')}>
                            <LayoutGrid className="w-4 h-4 mr-2" /> Seat Map
                        </TabButton>
                    </div>

                    {/* Content */}
                    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden shadow-inner min-h-[400px]">
                        {activeTab === 'timetable' && (
                            <Table
                                headers={['Date', 'Time', 'Course']}
                                rows={data.timetable.map(t => [t.date, `${t.start_time} - ${t.end_time}`, t.course_code])}
                            />
                        )}
                        {activeTab === 'allocations' && (
                            <Table
                                headers={['Student', 'Exam', 'Room', 'Seat']}
                                rows={data.allocations.map(a => [a.student_id, a.exam_course_code, a.room_id, a.seat_number])}
                            />
                        )}
                        {activeTab === 'visual' && (
                            <SeatVisualization
                                allocations={data.allocations}
                                rooms={data.rooms || []}
                                timetable={data.timetable}
                                buildings={buildings}
                            />
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon, color }) => (
    <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card border border-white/10 p-5 rounded-2xl flex justify-between items-center hover:border-indigo-500/30 transition-all"
    >
        <div>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">{label}</div>
            <div className={`text-2xl font-display font-bold ${color || 'text-white'}`}>
                {value}
            </div>
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
    </motion.div>
);

const TabButton = ({ children, active, onClick }) => (
    <button
        onClick={onClick}
        className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 flex items-center ${active ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-white/50 hover:text-white'}`}
    >
        {children}
    </button>
);

const Table = ({ headers, rows }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="bg-black/20 text-white/70">
                <tr>
                    {headers.map((h, i) => <th key={i} className="p-4 font-medium">{h}</th>)}
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {rows.length === 0 ? (
                    <tr><td colSpan={headers.length} className="p-8 text-center text-white/30">No data available</td></tr>
                ) : (
                    rows.map((row, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                            {row.map((cell, j) => <td key={j} className="p-4 text-white/80">{cell}</td>)}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);



export default ExamAgentView;
