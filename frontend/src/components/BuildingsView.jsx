import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Building2, Search, Plus, MapPin, ArrowRight, Loader2, Castle, LandPlot, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import RoomView from './RoomView';


const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Placeholder gradients for "Fantasy Illustrations"
const cardGradients = [
    "from-purple-900 to-indigo-900",
    "from-blue-900 to-slate-900",
    "from-emerald-900 to-teal-900",
    "from-rose-900 to-pink-900",
    "from-amber-900 to-orange-900",
];

const BuildingsView = ({ onNavigate }) => {
    const { workspace } = useAuth();
    const [buildings, setBuildings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBuilding, setSelectedBuilding] = useState(null);
    const [search, setSearch] = useState("");
    const [showCreate, setShowCreate] = useState(false);

    // New Building Form State
    const [newBldg, setNewBldg] = useState({ id: "", name: "" });
    const [creating, setCreating] = useState(false);
    const [editingBuildingId, setEditingBuildingId] = useState(null);
    const [editBuildingData, setEditBuildingData] = useState({ id: "", name: "" });

    useEffect(() => {
        if (workspace) fetchBuildings();
    }, [workspace]);

    const fetchBuildings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/buildings`);
            setBuildings(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newBldg.id || !newBldg.id.trim() || !newBldg.name || !newBldg.name.trim()) {
            alert("Please provide both structure code and name");
            return;
        }
        setCreating(true);
        try {
            await axios.post(`${API_URL}/workspaces/${workspace.id}/buildings`, {
                ...newBldg, workspace_id: workspace.id
            });
            setNewBldg({ id: "", name: "" });
            setShowCreate(false);
            fetchBuildings();
        } catch (err) {
            console.error(err);
            alert("Failed to create building");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Delete this building and all its rooms?")) return;
        try {
            if (!id) {
                await axios.delete(`${API_URL}/workspaces/${workspace.id}/buildings`, { params: { id: id } });
            } else {
                await axios.delete(`${API_URL}/workspaces/${workspace.id}/buildings/${id}`);
            }
            fetchBuildings();
        } catch (err) { console.error(err); alert("Delete failed"); }
    }

    const startEditBuilding = (e, b) => {
        e.stopPropagation();
        setEditingBuildingId(b.id);
        setEditBuildingData({ id: b.id, name: b.name });
    }

    const cancelEditBuilding = (e) => {
        e && e.stopPropagation();
        setEditingBuildingId(null);
        setEditBuildingData({ id: "", name: "" });
    }

    const submitEditBuilding = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_URL}/workspaces/${workspace.id}/buildings/${editingBuildingId}`, editBuildingData);
            setEditingBuildingId(null);
            fetchBuildings();
        } catch (err) {
            console.error(err);
            alert("Failed to update building");
        }
    }

    if (selectedBuilding) {
        return <RoomSelectionView building={selectedBuilding} onBack={() => setSelectedBuilding(null)} />;
    }

    const filteredBuildings = buildings.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Search */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96 group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative flex items-center bg-black rounded-lg border border-white/10">
                        <Search className="w-5 h-5 text-gray-400 ml-3" />
                        <input
                            type="text"
                            placeholder="Search structures..."
                            className="w-full bg-transparent text-white px-3 py-2.5 focus:outline-none placeholder:text-gray-500"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="relative px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(147,51,234,0.5)] hover:shadow-[0_0_25px_rgba(147,51,234,0.7)] transition-all flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    <span>Summon Structure</span>
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <form onSubmit={handleCreate} className="bg-white/5 border border-purple-500/30 p-4 rounded-xl flex gap-4 items-end animate-in slide-in-from-top-4">
                    <div className="flex-1">
                        <label className="text-xs text-purple-300 mb-1 block">Structure Code</label>
                        <input value={newBldg.id} onChange={e => setNewBldg({ ...newBldg, id: e.target.value })} className="w-full bg-black/40 border border-purple-500/20 rounded p-2 text-white" placeholder="e.g. TWR-1" />
                    </div>
                    <div className="flex-[2]">
                        <label className="text-xs text-purple-300 mb-1 block">Structure Name</label>
                        <input value={newBldg.name} onChange={e => setNewBldg({ ...newBldg, name: e.target.value })} className="w-full bg-black/40 border border-purple-500/20 rounded p-2 text-white" placeholder="e.g. Tower of Wisdom" />
                    </div>
                    <button disabled={creating} type="submit" className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-500">
                        {creating ? <Loader2 className="animate-spin" /> : "Bind"}
                    </button>
                </form>
            )}

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 text-purple-500 animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {filteredBuildings.map((b, idx) => (
                        <div
                            key={b.id}
                            onClick={() => { if (!editingBuildingId) setSelectedBuilding(b); }}
                            className="group relative bg-gray-900 border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-300"
                        >
                            {/* Edit & Delete Buttons */}
                            <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => startEditBuilding(e, b)}
                                    className="p-2 rounded-full bg-black/50 text-white/50 hover:bg-indigo-600 hover:text-white transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, b.id)}
                                    className="p-2 rounded-full bg-black/50 text-white/50 hover:bg-red-500 hover:text-white transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* If editing this building, show inline edit form */}
                            {editingBuildingId === b.id ? (
                                <form onSubmit={submitEditBuilding} onClick={e => e.stopPropagation()} className="p-6 bg-gray-800/90 min-h-[280px] flex flex-col justify-center">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Structure Code</label>
                                            <input value={editBuildingData.id} onChange={e => setEditBuildingData({ ...editBuildingData, id: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Structure Name</label>
                                            <input value={editBuildingData.name} onChange={e => setEditBuildingData({ ...editBuildingData, name: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button type="submit" onClick={e => e.stopPropagation()} className="flex-1 bg-green-600 hover:bg-green-500 px-4 py-2 rounded text-sm font-medium transition-colors">Save</button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); cancelEditBuilding(e); }} className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-sm font-medium transition-colors">Cancel</button>
                                        </div>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    {/* Image Placeholder */}
                                    <div className={`h-40 bg-gradient-to-br ${cardGradients[idx % cardGradients.length]} flex items-center justify-center relative overflow-hidden`}>
                                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-30"></div>
                                        <Castle className="w-16 h-16 text-white/20 group-hover:text-white/40 transform group-hover:scale-110 transition-all duration-500" />
                                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-gray-900 to-transparent"></div>
                                        <div className="absolute bottom-3 left-4">
                                            <h3 className="text-xl font-bold text-white shadow-sm">{b.name}</h3>
                                            <span className="text-xs text-white/60 font-mono tracking-wider">{b.id}</span>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="p-4 relative">
                                        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                                        <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-2">
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <LandPlot className="w-3 h-3" />
                                                {b.floors || 0} Floor{(b.floors || 0) !== 1 ? 's' : ''}
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-purple-500 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all" />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {filteredBuildings.length === 0 && !loading && (
                        <div className="col-span-full text-center py-20 text-gray-500">
                            No structures found in this realm.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Sub-view: Floors & Rooms in a Building (floors = simple integer count)

const RoomSelectionView = ({ building, onBack }) => {
    const { workspace } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [loading, setLoading] = useState(true);

    const [newRoom, setNewRoom] = useState({ id: "", name: "", capacity: 60, rows: 10, columns: 6, seating_type: "Single", _forFloor: null });
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [editingRoomId, setEditingRoomId] = useState(null);
    const [editRoomData, setEditRoomData] = useState({ id: "", name: "", capacity: 60, rows: 10, columns: 6, seating_type: "Single" });

    const [floorCount, setFloorCount] = useState(building.floors || 0);
    const [expandedFloors, setExpandedFloors] = useState({});
    const [addingFloor, setAddingFloor] = useState(false);

    useEffect(() => {
        fetchRooms();
    }, [building.id]);

    const fetchRooms = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/buildings/${building.id}/rooms`);
            setRooms(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleFloor = (floorNum) => setExpandedFloors(prev => ({ ...prev, [floorNum]: !prev[floorNum] }));

    // Add Floor = increment count by 1
    const handleAddFloor = async () => {
        setAddingFloor(true);
        const newCount = floorCount + 1;
        try {
            await axios.put(`${API_URL}/workspaces/${workspace.id}/buildings/${building.id}`, {
                ...building, floors: newCount
            });
            setFloorCount(newCount);
            setExpandedFloors(prev => ({ ...prev, [newCount]: true }));
        } catch (err) { alert("Failed to add floor"); console.error(err); }
        finally { setAddingFloor(false); }
    };

    // Delete last floor only (if no rooms on it)
    const handleDeleteFloor = async (floorNum) => {
        const roomsOnFloor = rooms.filter(r => Number(r.floor_id) === floorNum);
        if (roomsOnFloor.length > 0) {
            alert(`Cannot delete Floor ${floorNum}. It has ${roomsOnFloor.length} room(s). Remove them first.`);
            return;
        }
        if (!window.confirm(`Delete Floor ${floorNum}?`)) return;
        try {
            const newCount = floorCount - 1;
            await axios.put(`${API_URL}/workspaces/${workspace.id}/buildings/${building.id}`, {
                ...building, floors: newCount
            });
            setFloorCount(newCount);
            setExpandedFloors(prev => { const n = { ...prev }; delete n[floorNum]; return n; });
        } catch (err) { alert("Failed to delete floor"); }
    };

    // Room CRUD
    const handleCreateRoom = async (e, floorNum) => {
        e.preventDefault();
        const roomId = newRoom._forFloor === floorNum ? newRoom.id : "";
        if (!roomId) return;
        if (rooms.find(r => r.id === roomId)) {
            alert("Room ID must be unique across the building. This room ID already exists.");
            return;
        }
        setCreatingRoom(true);
        try {
            await axios.post(`${API_URL}/workspaces/${workspace.id}/rooms`, {
                id: roomId,
                name: (newRoom._forFloor === floorNum ? newRoom.name : "") || "classroom",
                capacity: newRoom._forFloor === floorNum ? newRoom.capacity : 60,
                rows: newRoom._forFloor === floorNum ? newRoom.rows : 10,
                columns: newRoom._forFloor === floorNum ? newRoom.columns : 6,
                seating_type: newRoom._forFloor === floorNum ? newRoom.seating_type : "Single",
                building_id: building.id,
                floor_id: floorNum,
                workspace_id: workspace.id
            });
            setNewRoom({ id: "", name: "", capacity: 60, rows: 10, columns: 6, seating_type: "Single", _forFloor: null });
            fetchRooms();
        } catch (err) { alert("Failed to create room"); }
        finally { setCreatingRoom(false); }
    };

    const handleDeleteRoom = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Delete this room?")) return;
        try {
            await axios.delete(`${API_URL}/workspaces/${workspace.id}/rooms/${id}`);
            fetchRooms();
        } catch (err) { alert("Delete failed"); }
    };

    const startEditRoom = (e, r) => {
        e.stopPropagation();
        setEditingRoomId(r.id);
        setEditRoomData({ id: r.id, name: r.name, capacity: r.capacity, rows: r.rows || 10, columns: r.columns || 6, seating_type: r.seating_type || "Single" });
    };

    const submitEditRoom = async (e) => {
        e.preventDefault();
        try {
            const exists = rooms.find(r => r.id === editRoomData.id && editingRoomId !== r.id);
            if (exists) { alert("Room ID already exists"); return; }
            await axios.put(`${API_URL}/workspaces/${workspace.id}/rooms/${editingRoomId}`, editRoomData);
            setEditingRoomId(null);
            fetchRooms();
        } catch (err) { alert("Failed to update room"); }
    };

    if (selectedRoom) {
        return <RoomView room={selectedRoom} building={building} onBack={() => setSelectedRoom(null)} />;
    }

    // Generate floor numbers array: [1, 2, 3, ..., floorCount]
    const floorNumbers = Array.from({ length: floorCount }, (_, i) => i + 1);

    return (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <button onClick={onBack} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition-colors">
                <ArrowRight className="w-4 h-4 rotate-180" /> Back to Campus Map
            </button>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white">{building.name} <span className="text-gray-500 text-lg font-normal">({building.id})</span></h2>
                    <p className="text-gray-400 max-w-2xl">Manage floors and rooms. <span className="text-purple-400 font-semibold">{floorCount} floor{floorCount !== 1 ? 's' : ''}</span></p>
                </div>
                <button
                    onClick={handleAddFloor}
                    disabled={addingFloor}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium shadow-[0_0_15px_rgba(147,51,234,0.4)] hover:shadow-[0_0_25px_rgba(147,51,234,0.6)] transition-all flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    {addingFloor ? "Adding..." : "Add Floor"}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 text-purple-500 animate-spin" /></div>
            ) : (
                <div className="space-y-4">
                    {floorNumbers.map(floorNum => {
                        const floorRooms = rooms.filter(r => Number(r.floor_id) === floorNum);
                        const isExpanded = expandedFloors[floorNum];

                        return (
                            <div key={floorNum} className="bg-gray-800/30 border border-white/5 rounded-xl overflow-hidden">
                                {/* Floor Header */}
                                <div
                                    className="bg-gray-800/80 px-5 py-3.5 flex justify-between items-center cursor-pointer hover:bg-gray-700/60 transition-colors"
                                    onClick={() => toggleFloor(floorNum)}
                                >
                                    <div className="flex items-center gap-3">
                                        {isExpanded
                                            ? <ChevronDown className="w-5 h-5 text-purple-400" />
                                            : <ChevronRight className="w-5 h-5 text-gray-400" />
                                        }
                                        <h3 className="text-lg font-semibold text-white">Floor {floorNum}</h3>
                                        <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{floorRooms.length} room{floorRooms.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    {/* Only allow deleting the LAST floor */}
                                    {floorNum === floorCount && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteFloor(floorNum); }}
                                            className="p-1.5 rounded bg-black/50 text-white/50 hover:bg-red-500 hover:text-white transition-colors"
                                            title="Delete this floor (last floor only)"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Floor Content (rooms) */}
                                {isExpanded && (
                                    <div className="p-4 border-t border-white/5 space-y-4">
                                        {/* Add Room Form */}
                                        <form onSubmit={(e) => handleCreateRoom(e, floorNum)} className="flex gap-2 items-end flex-wrap bg-black/20 p-3 rounded-lg border border-white/5">
                                            <div className="flex flex-col">
                                                <label className="text-[10px] text-gray-500 mb-0.5">Room ID</label>
                                                <input className="bg-black/40 border border-white/10 rounded p-1.5 text-white text-xs w-24" placeholder="3 digits" value={newRoom._forFloor === floorNum ? newRoom.id : ""} onChange={e => setNewRoom({ ...newRoom, _forFloor: floorNum, id: e.target.value })} required pattern="\d{3}" title="3 digit number" />
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-[120px]">
                                                <label className="text-[10px] text-gray-500 mb-0.5">Name</label>
                                                <input className="bg-black/40 border border-white/10 rounded p-1.5 text-white text-xs" placeholder="classroom" value={newRoom._forFloor === floorNum ? newRoom.name : ""} onChange={e => setNewRoom({ ...newRoom, _forFloor: floorNum, name: e.target.value })} />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[10px] text-gray-500 mb-0.5">Seating</label>
                                                <select className="bg-black/40 border border-white/10 rounded p-1.5 text-white text-xs" value={newRoom._forFloor === floorNum ? newRoom.seating_type : "Single"} onChange={e => setNewRoom({ ...newRoom, _forFloor: floorNum, seating_type: e.target.value })}>
                                                    <option value="Single">Single</option>
                                                    <option value="Two">Two</option>
                                                    <option value="Three">Three</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[10px] text-gray-500 mb-0.5">Rows</label>
                                                <input type="number" className="bg-black/40 border border-white/10 rounded p-1.5 text-white text-xs w-14" value={newRoom._forFloor === floorNum ? newRoom.rows : 10} onChange={e => setNewRoom({ ...newRoom, _forFloor: floorNum, rows: Number(e.target.value) })} required />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[10px] text-gray-500 mb-0.5">Cols</label>
                                                <input type="number" className="bg-black/40 border border-white/10 rounded p-1.5 text-white text-xs w-14" value={newRoom._forFloor === floorNum ? newRoom.columns : 6} onChange={e => setNewRoom({ ...newRoom, _forFloor: floorNum, columns: Number(e.target.value) })} required />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-[10px] text-gray-500 mb-0.5">Capacity</label>
                                                <input type="number" className="bg-black/40 border border-white/10 rounded p-1.5 text-white text-xs w-16" value={newRoom._forFloor === floorNum ? newRoom.capacity : 60} onChange={e => setNewRoom({ ...newRoom, _forFloor: floorNum, capacity: Number(e.target.value) })} required />
                                            </div>
                                            <button disabled={creatingRoom} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded text-xs font-medium self-end">{creatingRoom ? "..." : "Add Room"}</button>
                                        </form>

                                        {/* Room Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {floorRooms.map(r => (
                                                <div key={r.id} onClick={() => { if (!editingRoomId) setSelectedRoom(r); }} className="bg-gray-800/50 hover:bg-purple-900/20 border border-white/10 hover:border-purple-500/30 p-4 rounded-xl cursor-pointer group relative transition-all">
                                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => startEditRoom(e, r)} className="p-1 rounded bg-black/50 text-white/50 hover:bg-indigo-600 hover:text-white transition-colors"><Edit2 className="w-3 h-3" /></button>
                                                        <button onClick={(e) => handleDeleteRoom(e, r.id)} className="p-1 rounded bg-black/50 text-white/50 hover:bg-red-500 hover:text-white transition-colors"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                    {editingRoomId === r.id ? (
                                                        <form onSubmit={submitEditRoom} onClick={e => e.stopPropagation()} className="space-y-2">
                                                            <input value={editRoomData.id} onChange={e => setEditRoomData({ ...editRoomData, id: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-1.5 text-white text-xs" required pattern="\d{3}" />
                                                            <input value={editRoomData.name} onChange={e => setEditRoomData({ ...editRoomData, name: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-1.5 text-white text-xs" placeholder="Name" />
                                                            <select value={editRoomData.seating_type} onChange={e => setEditRoomData({ ...editRoomData, seating_type: e.target.value })} className="w-full bg-black/40 border border-white/20 rounded p-1.5 text-white text-xs">
                                                                <option value="Single">Single</option>
                                                                <option value="Two">Two</option>
                                                                <option value="Three">Three</option>
                                                            </select>
                                                            <div className="flex gap-2">
                                                                <input type="number" value={editRoomData.rows} onChange={e => setEditRoomData({ ...editRoomData, rows: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-1.5 text-white text-xs" placeholder="Rows" />
                                                                <input type="number" value={editRoomData.columns} onChange={e => setEditRoomData({ ...editRoomData, columns: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-1.5 text-white text-xs" placeholder="Cols" />
                                                            </div>
                                                            <input type="number" value={editRoomData.capacity} onChange={e => setEditRoomData({ ...editRoomData, capacity: Number(e.target.value) })} className="w-full bg-black/40 border border-white/20 rounded p-1.5 text-white text-xs" placeholder="Capacity" />
                                                            <div className="flex gap-2 pt-1">
                                                                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-xs text-white font-medium">Save</button>
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); setEditingRoomId(null); }} className="flex-1 bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-xs text-white font-medium">Cancel</button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="w-9 h-9 rounded-lg bg-gray-700/50 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                                                    <span className="font-mono font-bold text-sm text-white">{r.id}</span>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-0.5">
                                                                    <span className="bg-white/5 text-[10px] px-1.5 py-0.5 rounded text-gray-400">{r.capacity} seats</span>
                                                                    <span className="text-[10px] text-purple-400 font-medium">{r.seating_type || "Single"}</span>
                                                                </div>
                                                            </div>
                                                            <h4 className="font-medium text-white text-sm">{r.name}</h4>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                            {floorRooms.length === 0 && (
                                                <div className="col-span-full py-6 text-center text-gray-500 text-xs italic">No rooms on this floor yet</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {floorCount === 0 && (
                        <div className="text-center py-16 text-gray-500">
                            <p className="text-lg mb-2">No floors yet</p>
                            <p className="text-sm">Click <span className="text-purple-400 font-semibold">"Add Floor"</span> above to create Floor 1.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BuildingsView;
