import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Layers, GraduationCap, Plus, Loader2, Edit2, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const OrganizationManager = () => {
    const { workspace } = useAuth();
    const [activeTab, setActiveTab] = useState('departments');
    const [degrees, setDegrees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [data, setData] = useState([]);
    const [newItem, setNewItem] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (workspace) fetchData();
    }, [workspace, activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [deptRes, progRes, degRes] = await Promise.all([
                axios.get(`${API_URL}/workspaces/${workspace.id}/departments`),
                axios.get(`${API_URL}/workspaces/${workspace.id}/programs`),
                axios.get(`${API_URL}/workspaces/${workspace.id}/degrees`)
            ]);
            setDepartments(deptRes.data);
            setData(progRes.data); // 'data' will hold the current tab's items
            setDegrees(degRes.data);

            // Re-map display data based on activeTab
            if (activeTab === 'departments') setData(deptRes.data);
            else if (activeTab === 'programs') setData(progRes.data);
            else if (activeTab === 'degrees') setData(degRes.data);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            let payload = { ...newItem, workspace_id: workspace.id };

            if (activeTab === 'programs') {
                const degree = degrees.find(d => (d._id || d.id) === newItem.degree_id);
                const dept = departments.find(d => (d._id || d.id) === newItem.department_id);
                if (degree && dept) {
                    payload.name = `${degree.name} in ${dept.name}`;
                } else {
                    alert("Please select both degree and department");
                    return;
                }
            }

            await axios.post(`${API_URL}/workspaces/${workspace.id}/${activeTab}`, payload);
            setNewItem({});
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        const typeLabel = activeTab === 'departments' ? 'department' : activeTab === 'programs' ? 'program' : 'degree';
        if (!window.confirm(`Delete this ${typeLabel}?`)) return;
        try {
            await axios.delete(`${API_URL}/workspaces/${workspace.id}/${activeTab}/${id}`);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const startEdit = (e, item) => {
        e.stopPropagation();
        setEditingId(item._id || item.id);
        setEditData(activeTab === 'departments' ? { id: item.id, name: item.name } : { code: item.code, name: item.name });
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
        } catch (err) { console.error(err); }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex gap-4 mb-6 border-b border-white/10">
                <button onClick={() => setActiveTab('departments')} className={`pb-2 px-1 text-sm font-medium flex items-center gap-2 ${activeTab === 'departments' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400'}`}>
                    <Layers className="w-4 h-4" /> Departments
                </button>
                <button onClick={() => setActiveTab('degrees')} className={`pb-2 px-1 text-sm font-medium flex items-center gap-2 ${activeTab === 'degrees' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400'}`}>
                    <GraduationCap className="w-4 h-4" /> Degrees
                </button>
                <button onClick={() => setActiveTab('programs')} className={`pb-2 px-1 text-sm font-medium flex items-center gap-2 ${activeTab === 'programs' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400'}`}>
                    <Plus className="w-4 h-4" /> Programs
                </button>
            </div>

            <form onSubmit={handleCreate} className="mb-6 flex flex-wrap gap-4 items-end">
                {activeTab === 'departments' && (
                    <>
                        <input value={newItem.id || ''} onChange={e => setNewItem({ ...newItem, id: e.target.value })} placeholder="ID (CSE)" className="bg-black/40 border border-white/10 rounded p-2 text-white" required />
                        <input value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="Name" className="bg-black/40 border border-white/10 rounded p-2 text-white flex-1" required />
                    </>
                )}
                {activeTab === 'degrees' && (
                    <input value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="Degree Name (e.g. B.Tech)" className="bg-black/40 border border-white/10 rounded p-2 text-white flex-1" required />
                )}
                {activeTab === 'programs' && (
                    <>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-gray-400 mb-1">Select Degree</label>
                            <select
                                value={newItem.degree_id || ''}
                                onChange={e => setNewItem({ ...newItem, degree_id: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white"
                                required
                            >
                                <option value="">Select Degree</option>
                                {degrees.map(d => <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-gray-400 mb-1">Select Department</label>
                            <select
                                value={newItem.department_id || ''}
                                onChange={e => setNewItem({ ...newItem, department_id: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded p-2 text-white"
                                required
                            >
                                <option value="">Select Dept</option>
                                {departments.map(d => <option key={d._id || d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </>
                )}
                <button className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded text-white text-sm font-bold flex items-center gap-2 transition-all">
                    <Plus className="w-4 h-4" /> Add {activeTab.slice(0, -1)}
                </button>
            </form>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.map(item => (
                        <div key={item._id || item.id} className="bg-white/5 p-4 rounded border border-white/10 group relative hover:border-emerald-500/30 transition-colors">
                            {editingId === (item._id || item.id) ? (
                                <form onSubmit={submitEdit} onClick={e => e.stopPropagation()} className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">{activeTab === 'departments' ? 'Department ID' : 'Program Code'}</label>
                                        <input value={editData[activeTab === 'departments' ? 'id' : 'code'] || ''} onChange={e => setEditData({ ...editData, [activeTab === 'departments' ? 'id' : 'code']: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">{activeTab === 'departments' ? 'Department Name' : 'Program Name'}</label>
                                        <input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" required />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" onClick={e => e.stopPropagation()} className="flex-1 bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm font-medium transition-colors">Save</button>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); cancelEdit(e); }} className="flex-1 bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded text-sm font-medium transition-colors">Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => startEdit(e, item)} className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" title="Edit">
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button onClick={(e) => handleDelete(e, item._id || item.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Delete">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <h4 className="font-bold text-white">{item.id || item.code || ''}</h4>
                                    <p className="text-gray-300 font-medium">{item.name}</p>
                                    {activeTab === 'programs' && (
                                        <div className="mt-2 flex gap-2">
                                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                                                {degrees.find(d => (d._id || d.id) === item.degree_id)?.name || 'Unknown Degree'}
                                            </span>
                                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                                                {item.department_id}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                    {data.length === 0 && <div className="col-span-full text-center py-8 text-gray-500">No {activeTab} found.</div>}
                </div>
            )}
        </div>
    );
};

export default OrganizationManager;
