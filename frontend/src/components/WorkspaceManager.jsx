import React, { useState } from 'react';
import BuildingsView from './BuildingsView';
import AcademicManager from './AcademicManager';
import StudentsManager from './StudentsManager';
import OrganizationManager from './OrganizationManager';
import CalendarManager from './CalendarManager';
import { Map, BookOpen, Layers, User, Users, Calendar } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const WorkspaceManager = () => {
    const { workspace, user } = useAuth();
    const [activeTab, setActiveTab] = useState('map'); // map, academics, students, organization, settings

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            {/* Top Navigation for Manager */}
            <div className="bg-white/5 p-2 rounded-xl border border-white/10 backdrop-blur-md flex gap-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 min-w-[120px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'map' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Map className="w-4 h-4" /> Campus Map
                </button>
                <button
                    onClick={() => setActiveTab('academics')}
                    className={`flex-1 min-w-[120px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'academics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <BookOpen className="w-4 h-4" /> Academics
                </button>
                <button
                    onClick={() => setActiveTab('students')}
                    className={`flex-1 min-w-[120px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'students' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Users className="w-4 h-4" /> Students
                </button>
                <button
                    onClick={() => setActiveTab('organization')}
                    className={`flex-1 min-w-[120px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'organization' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Layers className="w-4 h-4" /> Organization
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 min-w-[120px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'settings' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <User className="w-4 h-4" /> Team & Invite
                </button>
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`flex-1 min-w-[120px] py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'calendar' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Calendar className="w-4 h-4" /> Calendar
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-black/20 p-6 rounded-xl border border-white/5 min-h-[500px]">
                {activeTab === 'map' && <BuildingsView onNavigate={setActiveTab} />}
                {activeTab === 'academics' && <AcademicManager onNavigate={setActiveTab} />}
                {activeTab === 'students' && <StudentsManager />}
                {activeTab === 'organization' && <OrganizationManager />}
                {activeTab === 'calendar' && <CalendarManager />}
                {activeTab === 'settings' && <InviteManager workspace={workspace} />}
            </div>
        </div>
    );
};

const InviteManager = ({ workspace }) => {
    const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState(null);

    const handleInvite = async (e) => {
        e.preventDefault();
        setSending(true);
        try {
            await axios.post(`${API_URL}/workspaces/${workspace.id}/invite`, { email });
            setMsg({ type: 'success', text: 'Invitation sent!' });
            setEmail("");
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to send invitation.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-md mx-auto animate-in fade-in">
            <h3 className="text-xl font-bold text-white mb-4">Invite Team Members</h3>
            <p className="text-gray-400 text-sm mb-6">Send an invitation email to add collaborators to <strong>{workspace.name}</strong>.</p>

            <form onSubmit={handleInvite} className="space-y-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Email Address</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-purple-500 transition-colors"
                        placeholder="colleague@university.edu"
                        required
                    />
                </div>
                {msg && <div className={`text-sm ${msg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</div>}

                <button disabled={sending} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium py-3 rounded-lg transition-colors flex justify-center items-center gap-2">
                    {sending ? "Sending..." : "Send Invitation"}
                </button>
            </form>

            <div className="mt-12 pt-8 border-t border-white/5">
                <h4 className="text-sm font-semibold text-gray-400 mb-4">Current Members</h4>
                <div className="space-y-2">
                    {workspace?.members?.map(m => (
                        <div key={m} className="flex items-center gap-3 text-sm text-gray-300">
                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center"><User className="w-4 h-4" /></div>
                            <span>{m}</span>
                        </div>
                    )) || <p className="text-gray-500 text-sm">No members found</p>}
                </div>
            </div>
        </div>
    )
}

export default WorkspaceManager;
