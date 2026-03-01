import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BookOpen, GraduationCap, Plus, Loader2, Calendar, Trash2, Edit2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AcademicManager = ({ onNavigate }) => {
    const { workspace } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('courses'); // courses, exam_cycles
    const [data, setData] = useState([]);
    const [courses, setCourses] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newItem, setNewItem] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [filters, setFilters] = useState({ semester: '', program_id: '', batch_year: '' });

    // Dropdown Data
    const [depts, setDepts] = useState([]);
    const [batches, setBatches] = useState([]);


    useEffect(() => {
        if (workspace) {
            setFilters({ semester: '', program_id: '', batch_year: '' });
            fetchData();
            fetchDropdownData();
        }
    }, [workspace, activeTab]);

    const fetchDropdownData = async () => {
        try {
            if (activeTab === 'courses') {
                const [deptRes, progRes, batchRes] = await Promise.all([
                    axios.get(`${API_URL}/workspaces/${workspace.id}/departments`),
                    axios.get(`${API_URL}/workspaces/${workspace.id}/programs`),
                    axios.get(`${API_URL}/workspaces/${workspace.id}/batches`)
                ]);
                setDepts(deptRes.data);
                setPrograms(progRes.data);
                setBatches(batchRes.data);
            } else {
                const [courseRes, progRes] = await Promise.all([
                    axios.get(`${API_URL}/workspaces/${workspace.id}/courses`),
                    axios.get(`${API_URL}/workspaces/${workspace.id}/programs`)
                ]);
                setCourses(courseRes.data);
                setPrograms(progRes.data);
            }
        } catch (err) { console.error("Dropdown fetch error", err); }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/${activeTab}`);
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await axios.post(`${API_URL}/workspaces/${workspace.id}/${activeTab}`, {
                ...newItem, workspace_id: workspace.id
            });
            setNewItem({});
            fetchData();
            if (activeTab === 'exam_cycles') {
                showToast(`Cycle created: ${res.data.students_added} students in ${res.data.programs_detected} programs detected.`, "success");
            } else {
                showToast(`${activeTab === 'courses' ? 'Course' : 'Exam'} created`, "success");
            }
        } catch (err) {
            showToast(`Failed to create ${activeTab === 'courses' ? 'course' : 'exam'}`, "error");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure?")) return;
        try {
            await axios.delete(`${API_URL}/workspaces/${workspace.id}/${activeTab}/${id}`);
            fetchData();
        } catch (err) { showToast("Delete failed", "error"); }
    };

    const startEdit = (e, item) => {
        e.stopPropagation();
        setEditingId(item._id || item.id);
        setEditData({ ...item });
    };

    const cancelEdit = (e) => {
        e && e.stopPropagation();
        setEditingId(null);
        setEditData({});
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_URL}/workspaces/${workspace.id}/${activeTab}/${editingId}`, editData);
            setEditingId(null);
            fetchData();
            showToast(`${activeTab === 'courses' ? 'Course' : 'Exam'} updated`, "success");
        } catch (err) {
            showToast("Update failed", "error");
        }
    };

    // Redirect handler for dropdowns
    const handleDeptChange = (e) => {
        if (e.target.value === 'new') {
            if (onNavigate) onNavigate('departments');
        } else {
            setNewItem({ ...newItem, department_id: e.target.value });
        }
    };

    const handleCourseChange = (e) => {
        if (e.target.value === 'new') {
            if (onNavigate) onNavigate('academics'); // Effectively reload to 'courses' tab context
            setActiveTab('courses');
        } else {
            setNewItem({ ...newItem, course_code: e.target.value });
        }
    }

    return (
        <div className="animate-in fade-in duration-500">
            {/* Sub-Tabs */}
            <div className="flex gap-4 mb-6 border-b border-white/10">
                <button onClick={() => setActiveTab('courses')} className={`pb-2 px-1 text-sm font-medium flex items-center gap-2 ${activeTab === 'courses' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>
                    <BookOpen className="w-4 h-4" /> Courses
                </button>
                <button onClick={() => setActiveTab('exam_cycles')} className={`pb-2 px-1 text-sm font-medium flex items-center gap-2 ${activeTab === 'exam_cycles' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>
                    <GraduationCap className="w-4 h-4" /> Exam Cycles
                </button>
            </div>

            {/* Create Form */}
            <form onSubmit={handleCreate} className="bg-white/5 p-4 rounded-xl border border-white/10 mb-6 flex flex-wrap gap-4 items-end">
                {activeTab === 'courses' ? (
                    <>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs text-gray-400 mb-1">Course Code</label>
                            <input value={newItem.code || ''} onChange={e => setNewItem({ ...newItem, code: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm" placeholder="CS101" required />
                        </div>
                        <div className="flex-2 min-w-[200px]">
                            <label className="block text-xs text-gray-400 mb-1">Course Name</label>
                            <input value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm" placeholder="Intro to Programming" required />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-gray-400 mb-1">Semester</label>
                            <input type="number" value={newItem.semester} onChange={e => setNewItem({ ...newItem, semester: Number(e.target.value) })} className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm" placeholder="1" required min="1" />
                        </div>
                        {/* <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs text-gray-400 mb-1">Department</label>
                            <select value={newItem.department_id || ''} onChange={handleDeptChange} className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm" required>
                                <option value="" disabled>Select Dept</option>
                                {depts.map(d => <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
                                <option value="new">+ Add Dept</option>
                            </select>
                        </div> */}
                        <div className="w-56">
                            <label className="block text-xs text-gray-400 mb-1">Programs</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(newItem.program_ids || []).map(pid => (
                                    <span key={pid} className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                                        {programs.find(p => (p._id || p.id) === pid)?.name || pid}
                                        <button type="button" onClick={() => setNewItem({ ...newItem, program_ids: newItem.program_ids.filter(id => id !== pid) })} className="hover:text-red-400">×</button>
                                    </span>
                                ))}
                            </div>
                            <select
                                value=""
                                onChange={e => {
                                    if (e.target.value && !(newItem.program_ids || []).includes(e.target.value)) {
                                        setNewItem({ ...newItem, program_ids: [...(newItem.program_ids || []), e.target.value] });
                                    }
                                }}
                                className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm"
                            >
                                <option value="">Add Program</option>
                                {programs.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="w-56">
                            <label className="block text-xs text-gray-400 mb-1">Batches</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(newItem.batch_ids || []).map(bid => (
                                    <span key={bid} className="bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                                        {bid}
                                        <button type="button" onClick={() => setNewItem({ ...newItem, batch_ids: newItem.batch_ids.filter(id => id !== bid) })} className="hover:text-red-400">×</button>
                                    </span>
                                ))}
                            </div>
                            <select
                                value=""
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    if (val && !(newItem.batch_ids || []).includes(val)) {
                                        setNewItem({ ...newItem, batch_ids: [...(newItem.batch_ids || []), val] });
                                    }
                                }}
                                className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm"
                            >
                                <option value="">Add Batch</option>
                                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-gray-400 mb-1">Cycle Name</label>
                            <input value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm" placeholder="Midterms 2026" required />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-gray-400 mb-1">Semester</label>
                            <input type="number" value={newItem.semester || 1} onChange={e => setNewItem({ ...newItem, semester: Number(e.target.value) })} className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm" placeholder="1" required min="1" />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-gray-400 mb-1">Batch Year</label>
                            <input type="number" value={newItem.batch_year || new Date().getFullYear()} onChange={e => setNewItem({ ...newItem, batch_year: Number(e.target.value) })} className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm" placeholder="2024" required min="2000" />
                        </div>
                        <div className="flex-[2_2_0%] min-w-[200px]">
                            <label className="block text-xs text-gray-400 mb-1">Programs Detection</label>
                            <div className="w-full bg-black/20 border border-white/10 rounded p-2 text-white/50 text-sm">
                                Automatically detected from students
                            </div>
                        </div>
                    </>
                )}
                <button disabled={creating} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg h-[38px] flex items-center gap-2">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                </button>
            </form>

            {/* List */}
            <div className="flex flex-wrap gap-4 mb-4">
                <select value={filters.semester} onChange={e => setFilters({ ...filters, semester: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">All Semesters</option>
                    {[...new Set(data.map(d => d.semester))].filter(Boolean).sort((a, b) => a - b).map(sem => (
                        <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                </select>
                <select value={filters.program_id} onChange={e => setFilters({ ...filters, program_id: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 max-w-[200px]">
                    <option value="">All Programs</option>
                    {programs.map(p => (
                        <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
                    ))}
                </select>
                <select value={filters.batch_year} onChange={e => setFilters({ ...filters, batch_year: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">All Batches</option>
                    {activeTab === 'exam_cycles' ? (
                        [...new Set(data.map(d => d.batch_year))].filter(Boolean).sort((a, b) => b - a).map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))
                    ) : (
                        [...new Set(data.flatMap(d => d.batch_ids || []))].filter(Boolean).sort((a, b) => b - a).map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))
                    )}
                </select>
                {(filters.semester || filters.program_id || filters.batch_year) && (
                    <button onClick={() => setFilters({ semester: '', program_id: '', batch_year: '' })} className="text-sm text-blue-400 hover:text-blue-300">
                        Clear Filters
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.filter(d => {
                        if (filters.semester && d.semester !== Number(filters.semester)) return false;
                        if (filters.program_id && activeTab === 'courses' && !(d.program_ids || []).includes(filters.program_id)) return false;
                        if (filters.program_id && activeTab === 'exam_cycles' && !(d.program_ids || []).includes(filters.program_id)) return false;
                        if (filters.batch_year && activeTab === 'courses' && !(d.batch_ids || []).includes(Number(filters.batch_year))) return false;
                        if (filters.batch_year && activeTab === 'exam_cycles' && d.batch_year !== Number(filters.batch_year)) return false;
                        return true;
                    }).map((item) => (
                        <div key={item._id || item.id} className="bg-white/5 border border-white/10 p-4 rounded-lg hover:border-blue-500/30 transition-colors group relative">
                            {editingId === (item._id || item.id) ? (
                                <form onSubmit={submitEdit} onClick={e => e.stopPropagation()} className="space-y-3">
                                    {activeTab === 'courses' ? (
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Course Code</label>
                                                <input value={editData.code || ''} onChange={e => setEditData({ ...editData, code: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Course Name</label>
                                                <input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Semester</label>
                                                <input type="number" value={editData.semester} onChange={e => setEditData({ ...editData, semester: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required min="1" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Department</label>
                                                <select value={editData.department_id || ''} onChange={e => setEditData({ ...editData, department_id: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required>
                                                    <option value="" disabled>Select Dept</option>
                                                    {depts.map(d => <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Programs</label>
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {(editData.program_ids || []).map(pid => (
                                                        <span key={pid} className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                                                            {programs.find(p => (p._id || p.id) === pid)?.name || pid}
                                                            <button type="button" onClick={() => setEditData({ ...editData, program_ids: editData.program_ids.filter(id => id !== pid) })} className="hover:text-red-400">×</button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <select
                                                    value=""
                                                    onChange={e => {
                                                        if (e.target.value && !(editData.program_ids || []).includes(e.target.value)) {
                                                            setEditData({ ...editData, program_ids: [...(editData.program_ids || []), e.target.value] });
                                                        }
                                                    }}
                                                    className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm"
                                                >
                                                    <option value="">Add Program</option>
                                                    {programs.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Batches</label>
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {(editData.batch_ids || []).map(bid => (
                                                        <span key={bid} className="bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                                                            {bid}
                                                            <button type="button" onClick={() => setEditData({ ...editData, batch_ids: editData.batch_ids.filter(id => id !== bid) })} className="hover:text-red-400">×</button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <select
                                                    value=""
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value);
                                                        if (val && !(editData.batch_ids || []).includes(val)) {
                                                            setEditData({ ...editData, batch_ids: [...(editData.batch_ids || []), val] });
                                                        }
                                                    }}
                                                    className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm"
                                                >
                                                    <option value="">Add Batch</option>
                                                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Cycle Name</label>
                                                <input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Semester</label>
                                                <input type="number" value={editData.semester || ''} onChange={e => setEditData({ ...editData, semester: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Batch Year</label>
                                                <input type="number" value={editData.batch_year || ''} onChange={e => setEditData({ ...editData, batch_year: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required min="2000" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Students Count</label>
                                                <div className="w-full bg-black/40 border border-white/20 rounded p-2 text-white/60 text-sm">
                                                    {editData.student_ids?.length || 0} enrolled
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Related Courses</label>
                                                <div className="w-full bg-black/40 border border-white/20 rounded p-2 text-white/60 text-sm">
                                                    {courses.filter(c =>
                                                        c.semester === editData.semester &&
                                                        (c.batch_ids || []).includes(editData.batch_year) &&
                                                        (c.program_ids || []).some(pid => (editData.program_ids || []).includes(pid))
                                                    ).length} courses detected
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Duration (Min)</label>
                                                <input type="number" value={editData.duration_minutes || 180} onChange={e => setEditData({ ...editData, duration_minutes: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                            </div>
                                        </>
                                    )}
                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" onClick={e => e.stopPropagation()} className="flex-1 bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm font-medium transition-colors">Save</button>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); cancelEdit(e); }} className="flex-1 bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded text-sm font-medium transition-colors">Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    {/* Edit & Delete Buttons */}
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => startEdit(e, item)}
                                            className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, item._id || item.id)}
                                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <div className="mb-2 pr-8">
                                        <h3 className="font-bold text-lg text-white mb-1 group-hover:text-blue-400 transition-colors">
                                            {item.code ? `${item.code} - ${item.name}` : item.name}
                                        </h3>
                                        {activeTab === 'courses' ? (
                                            <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-3">
                                                <div>
                                                    <p className="text-xs text-gray-500">Semester</p>
                                                    <p className="font-medium text-white">{item.semester}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Batches</p>
                                                    <p className="font-medium text-white">{(item.batch_ids || []).join(', ') || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Programs</p>
                                                    <p className="font-medium text-white truncate max-w-[150px]" title={(item.program_ids || []).map(pid => programs.find(p => (p._id || p.id) === pid)?.name || pid).join(', ')}>
                                                        {(item.program_ids || []).length} Programs
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-3">
                                                <div>
                                                    <p className="text-xs text-gray-500">Semester</p>
                                                    <p className="font-medium text-white">{item.semester}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Batch Year</p>
                                                    <p className="font-medium text-white">{item.batch_year}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Programs</p>
                                                    <p className="font-medium text-white truncate max-w-[150px]" title={(item.program_ids || []).map(pid => programs.find(p => (p._id || p.id) === pid)?.name || pid).join(', ')}>
                                                        {(item.program_ids || []).length} Programs
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Students</p>
                                                    <p className="font-medium text-white">{(item.student_ids || []).length}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Courses</p>
                                                    <p className="font-medium text-white">
                                                        {courses.filter(c =>
                                                            c.semester === item.semester &&
                                                            (c.batch_ids || []).includes(item.batch_year) &&
                                                            (c.program_ids || []).some(pid => (item.program_ids || []).includes(pid))
                                                        ).length}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {data.length === 0 && <div className="col-span-full text-center py-8 text-gray-500">No records found.</div>}
                </div>
            )
            }
        </div >
    );
};

export default AcademicManager;
