import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Users, Plus, Loader2, Upload, Edit2, Trash2, Download } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const StudentsManager = () => {
    const { workspace } = useAuth();
    const { showToast } = useToast();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newStudent, setNewStudent] = useState({ id: '', name: '', semester: 1, program_id: '', batch_year: new Date().getFullYear(), enrolled_courses: [] });
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [importing, setImporting] = useState(false);
    const [depts, setDepts] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [courses, setCourses] = useState([]);
    const [filters, setFilters] = useState({ semester: '', program_id: '', batch_year: '' });

    useEffect(() => {
        if (workspace) {
            fetchStudents();
            fetchDepartments();
            fetchPrograms();
            fetchCourses();
        }
    }, [workspace]);

    const fetchDepartments = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/departments`);
            setDepts(res.data);
        } catch (err) { console.error("Dept fetch error", err); }
    };

    const fetchPrograms = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/programs`);
            setPrograms(res.data);
        } catch (err) { console.error("Program fetch error", err); }
    };

    const fetchCourses = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/courses`);
            setCourses(res.data);
        } catch (err) { console.error("Course fetch error", err); }
    };

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/students`);
            setStudents(res.data);
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
            await axios.post(`${API_URL}/workspaces/${workspace.id}/students`, {
                ...newStudent,
                workspace_id: workspace.id
            });
            setNewStudent({ id: '', name: '', semester: 1, program_id: '', batch_year: new Date().getFullYear(), enrolled_courses: [] });
            fetchStudents();
            showToast("Student added", "success");
        } catch (err) {
            showToast("Failed to add student", "error");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Delete this student?")) return;
        try {
            await axios.delete(`${API_URL}/workspaces/${workspace.id}/students/${id}`);
            fetchStudents();
            showToast("Student deleted", "success");
        } catch (err) { showToast("Delete failed", "error"); }
    };

    const startEdit = (e, student) => {
        e.stopPropagation();
        setEditingId(student._id || student.id);
        setEditData({ ...student });
    };

    const cancelEdit = (e) => {
        e && e.stopPropagation();
        setEditingId(null);
        setEditData({});
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_URL}/workspaces/${workspace.id}/students/${editingId}`, editData);
            setEditingId(null);
            fetchStudents();
            showToast("Student updated", "success");
        } catch (err) {
            showToast("Update failed", "error");
        }
    };

    const getFilteredCourses = (programId, semester) => {
        if (!programId) return courses;
        return courses.filter(c => (c.program_ids || []).includes(programId) && c.semester === semester);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post(`${API_URL}/workspaces/${workspace.id}/students/import`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast(res.data.message, "success");
            fetchStudents();
        } catch (err) {
            showToast(err.response?.data?.detail || "Import failed", "error");
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const downloadTemplate = () => {
        const template = "id,name,semester,program_id,batch_year,enrolled_courses\nS001,John Doe,1,prog_id_1,2024,CS101,CS102\nS002,Jane Smith,2,prog_id_2,2023,EC101";
        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students_template.csv';
        a.click();
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Users className="w-6 h-6" /> Students
                </h2>
                <div className="flex gap-2">
                    <button onClick={downloadTemplate} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                        <Download className="w-4 h-4" /> Template
                    </button>
                    <label className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer">
                        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Import Excel
                        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={importing} />
                    </label>
                </div>
            </div>

            {/* Create Form */}
            <form onSubmit={handleCreate} className="bg-white/5 p-4 rounded-xl border border-white/10 mb-6 flex flex-wrap gap-4 items-end">
                <div className="w-32">
                    <label className="block text-xs text-gray-400 mb-1">Roll No</label>
                    <input
                        value={newStudent.id}
                        onChange={e => setNewStudent({ ...newStudent, id: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm"
                        placeholder="BT21..."
                        required
                    />
                </div>
                <div className="flex-[2_2_0%] min-w-[200px]">
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input
                        value={newStudent.name}
                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm"
                        placeholder="Student Name"
                        required
                    />
                </div>
                <div className="w-24">
                    <label className="block text-xs text-gray-400 mb-1">Batch Yr</label>
                    <input
                        type="number"
                        value={newStudent.batch_year}
                        onChange={e => setNewStudent({ ...newStudent, batch_year: Number(e.target.value) })}
                        className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm"
                        placeholder="2024"
                        required
                        min="2000"
                    />
                </div>
                <div className="w-24">
                    <label className="block text-xs text-gray-400 mb-1">Semester</label>
                    <input
                        type="number"
                        value={newStudent.semester}
                        onChange={e => setNewStudent({ ...newStudent, semester: Number(e.target.value) })}
                        className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm"
                        placeholder="1"
                        required
                        min="1"
                    />
                </div>
                <div className="flex-[2_2_0%] min-w-[200px]">
                    <label className="block text-xs text-gray-400 mb-1">Program</label>
                    <select
                        value={newStudent.program_id}
                        onChange={e => {
                            setNewStudent({
                                ...newStudent,
                                program_id: e.target.value
                            });
                        }}
                        className="w-full bg-black/20 border border-white/10 rounded p-2 text-white text-sm"
                        required
                    >
                        <option value="">Select Program</option>
                        {programs.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                    </select>
                </div>
                <button disabled={creating} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 h-9">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                </button>
            </form>

            {/* List */}
            <div className="flex flex-wrap gap-4 mb-4">
                <select value={filters.semester} onChange={e => setFilters({ ...filters, semester: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">All Semesters</option>
                    {[...new Set(students.map(s => s.semester))].sort((a, b) => a - b).map(sem => (
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
                    {[...new Set(students.map(s => s.batch_year))].filter(Boolean).sort((a, b) => b - a).map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
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
                    {students.filter(s => {
                        if (filters.semester && s.semester !== Number(filters.semester)) return false;
                        if (filters.program_id && s.program_id !== filters.program_id) return false;
                        if (filters.batch_year && s.batch_year !== Number(filters.batch_year)) return false;
                        return true;
                    }).map((student) => (
                        <div key={student._id || student.id} className="bg-white/5 border border-white/10 p-4 rounded-lg hover:border-blue-500/30 transition-colors group relative">
                            {editingId === (student._id || student.id) ? (
                                <form onSubmit={submitEdit} onClick={e => e.stopPropagation()} className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Roll No</label>
                                        <input value={editData.id} onChange={e => setEditData({ ...editData, id: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Name</label>
                                        <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Semester</label>
                                        <input type="number" value={editData.semester} placeholder='Semester' onChange={e => setEditData({ ...editData, semester: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required min="1" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Batch Year</label>
                                        <input type="number" value={editData.batch_year} placeholder='Batch format YYYY' onChange={e => setEditData({ ...editData, batch_year: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required min="2000" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Program</label>
                                        <select
                                            value={editData.program_id}
                                            onChange={e => {
                                                setEditData({
                                                    ...editData,
                                                    program_id: e.target.value
                                                });
                                            }}
                                            className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm"
                                            required
                                        >
                                            {programs.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Courses</label>
                                        <select
                                            value=""
                                            onChange={e => {
                                                if (e.target.value && !editData.enrolled_courses?.includes(e.target.value)) {
                                                    setEditData({ ...editData, enrolled_courses: [...(editData.enrolled_courses || []), e.target.value] });
                                                }
                                            }}
                                            className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm"
                                        >
                                            <option value="">Add Course</option>
                                            {getFilteredCourses(editData.program_id, editData.semester).map(c => <option key={c._id} value={c.code}>{c.name}</option>)}
                                        </select>
                                        {editData.enrolled_courses?.length > 0 && (
                                            <div className="mt-2 flex gap-1 flex-wrap">
                                                {editData.enrolled_courses.map(code => (
                                                    <span key={code} className="bg-blue-500/20 px-2 py-1 rounded text-xs flex items-center gap-1">
                                                        {code}
                                                        <button type="button" onClick={() => setEditData({ ...editData, enrolled_courses: editData.enrolled_courses.filter(c => c !== code) })} className="text-red-400 hover:text-red-300">×</button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" onClick={e => e.stopPropagation()} className="flex-1 bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm font-medium transition-colors">Save</button>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); cancelEdit(e); }} className="flex-1 bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded text-sm font-medium transition-colors">Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => startEdit(e, student)} className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" title="Edit">
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button onClick={(e) => handleDelete(e, student._id || student.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Delete">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-start mb-2 pr-8">
                                        <span className="font-mono text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">{student.id}</span>
                                        <span className="text-xs text-gray-400">
                                            Sem {student.semester} • {programs.find(p => (p._id || p.id) === student.program_id)?.department_id}
                                        </span>
                                    </div>
                                    <h4 className="font-semibold text-white">{student.name}</h4>
                                    <div className="mt-2 text-xs text-gray-500">
                                        <div>Program: {programs.find(p => (p._id || p.id) === student.program_id)?.name || 'Unknown'}</div>
                                        {student.enrolled_courses?.length > 0 && (
                                            <div className="mt-1">Courses: {student.enrolled_courses.join(', ')}</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {students.length === 0 && <div className="col-span-full text-center py-8 text-gray-500">No students found.</div>}
                </div>
            )}
        </div>
    );
};

export default StudentsManager;
