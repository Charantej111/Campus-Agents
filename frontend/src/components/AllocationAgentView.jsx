import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Users, AlertTriangle, CheckCircle, LayoutGrid, List as ListIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import SeatVisualization from './SeatVisualization';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AllocationAgentView = () => {
    const { workspace } = useAuth();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('visual');
    const [buildings, setBuildings] = useState([]);

    useEffect(() => {
        if (workspace) {
            fetchCurrentPlan();
            fetchBuildings();
        }
    }, [workspace]);

    const fetchCurrentPlan = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/exam_plan`);
            if (res.data && (res.data.timetable.length > 0 || res.data.allocations.length > 0)) {
                setData(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch plan", err);
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

    const handleAllocate = async () => {
        if (!data || !data.timetable.length) {
            setError("No timetable found to allocate seats for. Please run the Scheduling Agent first.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await axios.post(`${API_URL}/exam/allocate`, {
                workspace_id: workspace.id,
                timetable: data.timetable
            });
            setData(res.data);
            setActiveTab('visual');
        } catch (err) {
            setError(err.response?.data?.detail || "Allocation failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8 rounded-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                            <Users className="w-6 h-6 text-purple-400" />
                        </div>
                        <h2 className="text-3xl font-display font-bold text-white">
                            Allocation Agent
                        </h2>
                    </div>
                    <p className="text-base text-white/60 mb-6 max-w-2xl">
                        Intelligent seat and room allocation system. Distributes students across available exam rooms while ensuring zero conflicts.
                    </p>

                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-8 text-center mt-6">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-display font-bold text-white mb-2">Allocation Logic In Works</h3>
                        <p className="text-white/60 max-w-lg mx-auto">
                            The advanced seat and room allocation algorithms are currently being developed. Check back soon for intelligent seating plans!
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const StatCard = ({ label, value, icon, color }) => (
    <div className="glass-card border border-white/10 p-5 rounded-2xl flex justify-between items-center hover:border-indigo-500/30 transition-all">
        <div>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">{label}</div>
            <div className={`text-2xl font-display font-bold ${color || 'text-white'}`}>
                {value}
            </div>
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
    </div>
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

export default AllocationAgentView;
