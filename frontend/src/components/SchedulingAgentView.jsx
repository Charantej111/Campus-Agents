import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Calendar, AlertTriangle, CheckCircle, List as ListIcon, Trash2, Save, Download, Edit3 } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const SchedulingAgentView = () => {
    const { workspace } = useAuth();
    const [examCycles, setExamCycles] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [filterProgram, setFilterProgram] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        exam_cycle_id: "",
        start_date: "",
        gap_between_exams: 1,
        allow_two_exams_per_day: false,
        morning_slot_start: "09:00",
        morning_slot_end: "12:00",
        afternoon_slot_start: "14:00",
        afternoon_slot_end: "17:00",
        single_slot_choice: "morning",
        custom_instructions: ""
    });

    useEffect(() => {
        if (workspace) {
            fetchExamCycles();
            fetchPrograms();
        }
    }, [workspace]);

    const fetchExamCycles = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/exam_cycles`);
            setExamCycles(res.data);
            if (res.data.length > 0) {
                setFormData(prev => ({ ...prev, exam_cycle_id: res.data[0].id }));
            }
        } catch (err) {
            console.error("Failed to fetch exam cycles", err);
        }
    };

    const fetchPrograms = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/programs`);
            setPrograms(res.data);
        } catch (err) {
            console.error("Failed to fetch programs", err);
        }
    };

    const getProgramName = (programId) => {
        const p = programs.find(prog => (prog._id || prog.id) === programId);
        return p ? p.name : programId;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSchedule = async () => {
        if (!formData.exam_cycle_id || !formData.start_date) {
            setError("Please fill in required fields (Exam Cycle, Start Date)");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const payload = {
                workspace_id: workspace.id,
                ...formData,
                gap_between_exams: parseInt(formData.gap_between_exams)
            };

            if (!formData.allow_two_exams_per_day) {
                if (formData.single_slot_choice === 'morning') {
                    payload.afternoon_slot_start = "";
                    payload.afternoon_slot_end = "";
                } else {
                    payload.morning_slot_start = "";
                    payload.morning_slot_end = "";
                }
            }

            const res = await axios.post(`${API_URL}/exam/schedule`, payload);
            setData(res.data);
            setFilterProgram('');
        } catch (err) {
            setError(err.response?.data?.detail || "Scheduling failed");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRow = (index, field, value) => {
        const newData = { ...data };
        newData.timetable = [...data.timetable];
        newData.timetable[index] = { ...newData.timetable[index], [field]: value };
        setData(newData);
    };

    const handleDeleteRow = (index) => {
        const newData = { ...data };
        newData.timetable = data.timetable.filter((_, i) => i !== index);
        setData(newData);
    };

    const handleSavePlan = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/workspaces/${workspace.id}/exam_plan`, data);
            setError(null);
            alert("Timetable saved successfully!");
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save exam plan");
        } finally {
            setLoading(false);
        }
    };

    const handleClearLocal = () => {
        setData(null);
    };

    const handleDeleteAllDB = async () => {
        if (!window.confirm("Are you sure you want to delete ALL saved exam plans for this workspace?")) return;
        setLoading(true);
        try {
            await axios.delete(`${API_URL}/workspaces/${workspace.id}/exam_plans?id=all`);
            alert("All saved exam plans deleted from the database.");
            setData(null);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to delete exam plans");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadSavedPlan = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/exam_plan`);
            if (res.data && res.data.timetable && res.data.timetable.length > 0) {
                setData(res.data);
                setError(null);
            } else {
                alert("No saved timetable found for this workspace.");
            }
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to load saved plan");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCSV = () => {
        if (!data || !data.timetable || data.timetable.length === 0) return;

        const headers = ['Date', 'Course Code', 'Course Name', 'Start Time', 'End Time', 'Session', 'Programs', 'Batch Year'];
        const rows = filteredTimetable.map(t => [
            t.date,
            t.course_code,
            t.course_name || '',
            t.start_time,
            t.end_time,
            t.session,
            (t.program_ids || []).map(pid => getProgramName(pid)).join(' | '),
            t.batch_year
        ]);

        const csvContent = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exam_timetable.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Collect all unique program IDs from timetable for filter dropdown
    const allProgramIds = data?.timetable
        ? [...new Set(data.timetable.flatMap(t => t.program_ids || []))]
        : [];

    // Filter timetable by selected program
    const filteredTimetable = data?.timetable
        ? data.timetable.filter(t => {
            if (!filterProgram) return true;
            return (t.program_ids || []).includes(filterProgram);
        })
        : [];

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8 rounded-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <Calendar className="w-6 h-6 text-blue-400" />
                        </div>
                        <h2 className="text-3xl font-display font-bold text-white">
                            Scheduling Agent
                        </h2>
                    </div>
                    <p className="text-base text-white/60 mb-8 max-w-2xl">
                        Configure rules and constraints to intelligently generate an exam timetable. Exams for the same course across different programs are scheduled in parallel.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Exam Cycle</label>
                            <select
                                name="exam_cycle_id"
                                value={formData.exam_cycle_id}
                                onChange={handleChange}
                                className="w-full glass-card border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="" className="text-gray-900">Select Exam Cycle</option>
                                {examCycles.map(c => (
                                    <option key={c.id} value={c.id} className="text-gray-900">{c.name} Sem-{c.semester}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-white/70 mb-2">Start Date</label>
                            <input
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleChange}
                                className="w-full glass-card border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Min Gap Between Exams (Days)</label>
                            <input
                                type="number"
                                name="gap_between_exams"
                                min="0"
                                value={formData.gap_between_exams}
                                onChange={handleChange}
                                className="w-full glass-card border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center mt-8">
                            <input
                                type="checkbox"
                                id="allow_two_exams"
                                name="allow_two_exams_per_day"
                                checked={formData.allow_two_exams_per_day}
                                onChange={handleChange}
                                className="w-5 h-5 rounded border-white/20 text-blue-500 focus:ring-blue-500 mr-3"
                            />
                            <label htmlFor="allow_two_exams" className="text-sm font-medium text-white/80">
                                Allow two exams per day for a student
                            </label>
                        </div>
                        {!formData.allow_two_exams_per_day && (
                            <div className="md:col-span-2 flex gap-6 mt-2 mb-2">
                                <label className="flex items-center text-white/80 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="single_slot_choice"
                                        value="morning"
                                        checked={formData.single_slot_choice === 'morning'}
                                        onChange={handleChange}
                                        className="mr-2 text-blue-500 bg-black/30 border-white/20"
                                    />
                                    Use Morning Slot
                                </label>
                                <label className="flex items-center text-white/80 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="single_slot_choice"
                                        value="afternoon"
                                        checked={formData.single_slot_choice === 'afternoon'}
                                        onChange={handleChange}
                                        className="mr-2 text-blue-500 bg-black/30 border-white/20"
                                    />
                                    Use Afternoon Slot
                                </label>
                            </div>
                        )}
                        <div className={`md:col-span-2 grid gap-6 ${formData.allow_two_exams_per_day ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {(formData.allow_two_exams_per_day || formData.single_slot_choice === 'morning') && (
                                <div className="glass-card p-4 rounded-xl border border-white/10">
                                    <h4 className="text-white/80 font-medium mb-3">Morning Slot</h4>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs text-white/50 mb-1">Start Time</label>
                                            <input type="time" name="morning_slot_start" value={formData.morning_slot_start} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs text-white/50 mb-1">End Time</label>
                                            <input type="time" name="morning_slot_end" value={formData.morning_slot_end} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {(formData.allow_two_exams_per_day || formData.single_slot_choice === 'afternoon') && (
                                <div className="glass-card p-4 rounded-xl border border-white/10">
                                    <h4 className="text-white/80 font-medium mb-3">Afternoon Slot</h4>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs text-white/50 mb-1">Start Time</label>
                                            <input type="time" name="afternoon_slot_start" value={formData.afternoon_slot_start} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs text-white/50 mb-1">End Time</label>
                                            <input type="time" name="afternoon_slot_end" value={formData.afternoon_slot_end} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-white/70 mb-2">Custom Instructions (Optional)</label>
                            <textarea
                                name="custom_instructions"
                                value={formData.custom_instructions}
                                onChange={handleChange}
                                rows={3}
                                className="w-full glass-card border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-white/30"
                                placeholder="E.g., Schedule Math and Physics exams at least 3 days apart..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                        <motion.button
                            onClick={handleLoadSavedPlan}
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            Load DB Timetable
                        </motion.button>
                        <motion.button
                            onClick={handleDeleteAllDB}
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            Delete DB Timetables
                        </motion.button>
                        <motion.button
                            onClick={handleSchedule}
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/30"
                        >
                            {loading ? "Generating Schedule..." : "Generate Timetable"}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <StatCard
                            label="Status"
                            value={data.status}
                            icon={data.status === 'complete' ? <CheckCircle className="text-green-400" /> : <AlertTriangle className="text-yellow-400" />}
                        />
                        <StatCard
                            label="Total Exams Scheduled"
                            value={data.timetable.length}
                            icon={<Calendar className="text-blue-400" />}
                        />
                    </div>

                    {/* Errors */}
                    {data.errors && data.errors.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
                            <h3 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Errors</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                {data.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* Filter + Download Bar */}
                    <div className="flex flex-wrap items-center gap-4">
                        <select
                            value={filterProgram}
                            onChange={e => setFilterProgram(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        >
                            <option value="">All Programs</option>
                            {allProgramIds.map(pid => (
                                <option key={pid} value={pid}>{getProgramName(pid)}</option>
                            ))}
                        </select>
                        {filterProgram && (
                            <button onClick={() => setFilterProgram('')} className="text-sm text-blue-400 hover:text-blue-300">
                                Clear Filter
                            </button>
                        )}
                        <div className="ml-auto">
                            <motion.button
                                onClick={handleDownloadCSV}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="bg-emerald-600/80 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                            >
                                <Download className="w-4 h-4" /> Download CSV
                            </motion.button>
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden shadow-inner min-h-[400px]">
                        <EditableTable
                            timetable={filteredTimetable}
                            originalTimetable={data.timetable}
                            onUpdate={handleUpdateRow}
                            onDelete={handleDeleteRow}
                            getProgramName={getProgramName}
                        />
                    </div>

                    <div className="flex justify-end gap-4 mt-4">
                        <motion.button
                            onClick={handleClearLocal}
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-gray-600/50 hover:bg-gray-500/50 text-white border border-gray-500 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            Clear View
                        </motion.button>
                        <motion.button
                            onClick={handleSavePlan}
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-green-600/80 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-green-500/30"
                        >
                            <Save className="w-5 h-5" />
                            {loading ? "Saving..." : "Save Timetable to Database"}
                        </motion.button>
                    </div>
                </motion.div>
            )}
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

const EditableTable = ({ timetable, originalTimetable, onUpdate, onDelete, getProgramName }) => {
    // Map filtered rows back to the original index for updates/deletes
    const getOriginalIndex = (filteredRow) => {
        return originalTimetable.indexOf(filteredRow);
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-black/20 text-white/70">
                    <tr>
                        <th className="p-4 font-medium w-36">Date</th>
                        <th className="p-4 font-medium w-28">Start Time</th>
                        <th className="p-4 font-medium w-28">End Time</th>
                        <th className="p-4 font-medium">Course Code</th>
                        <th className="p-4 font-medium">Course Name</th>
                        <th className="p-4 font-medium w-24">Session</th>
                        <th className="p-4 font-medium">Programs</th>
                        <th className="p-4 font-medium w-24">Batch Year</th>
                        <th className="p-4 font-medium w-16 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {timetable.length === 0 ? (
                        <tr><td colSpan={9} className="p-8 text-center text-white/30">No data available</td></tr>
                    ) : (
                        timetable.map((row, i) => {
                            const origIdx = originalTimetable.findIndex(t => t === row || (t.course_code === row.course_code && t.date === row.date && t.start_time === row.start_time));
                            return (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                    <td className="p-2">
                                        <input type="date" value={row.date} onChange={e => onUpdate(origIdx, 'date', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none transition" />
                                    </td>
                                    <td className="p-2">
                                        <input type="time" value={row.start_time} onChange={e => onUpdate(origIdx, 'start_time', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none transition" />
                                    </td>
                                    <td className="p-2">
                                        <input type="time" value={row.end_time} onChange={e => onUpdate(origIdx, 'end_time', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none transition" />
                                    </td>
                                    <td className="p-2 px-4 text-white/80 font-mono text-xs">{row.course_code}</td>
                                    <td className="p-2 px-4 text-white/80">{row.course_name || '-'}</td>
                                    <td className="p-2 px-4">
                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${row.session === 'Morning' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                            {row.session}
                                        </span>
                                    </td>
                                    <td className="p-2 px-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(row.program_ids || []).map(pid => (
                                                <span key={pid} className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                                                    {getProgramName(pid)}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-2 px-4 text-white/80 text-center">{row.batch_year}</td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => onDelete(origIdx)} className="text-red-400 hover:text-red-300 p-1.5 rounded-md hover:bg-red-500/20 transition">
                                            <Trash2 className="w-4 h-4 mx-auto" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default SchedulingAgentView;
