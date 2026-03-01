import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Plus, Trash2, Edit2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const CalendarManager = () => {
    const { workspace } = useAuth();
    const { showToast } = useToast();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewDate, setViewDate] = useState(new Date());

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [formData, setFormData] = useState({ title: '', date: '', type: 'holiday' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (workspace) fetchEvents();
    }, [workspace, viewDate]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/calendar`);

            // Generate implicit public holidays based on currently viewed month/year
            const implicitEvents = generateImplicitHolidays(viewDate.getFullYear(), viewDate.getMonth());

            // Merge actual DB events with implicit events, let DB events override if same date
            const combined = [...implicitEvents];
            res.data.forEach(dbEvent => {
                const existingIdx = combined.findIndex(e => e.date === dbEvent.date);
                if (existingIdx >= 0) {
                    combined[existingIdx] = dbEvent;
                } else {
                    combined.push(dbEvent);
                }
            });

            setEvents(combined);
        } catch (err) {
            showToast("Failed to fetch calendar", "error");
        } finally {
            setLoading(false);
        }
    };

    const generateImplicitHolidays = (year, month) => {
        const implicit = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // 1. All Sundays
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            if (date.getDay() === 0) {
                implicit.push({
                    id: `implicit-sunday-${year}-${month}-${day}`,
                    title: 'Sunday',
                    date: _formatDate(date),
                    type: 'holiday',
                    isImplicit: true
                });
            }
        }

        // 2. Fixed Public Holidays (New Year, etc) - Very basic example
        const fixedHolidays = {
            "01-01": "New Year's Day",
            "12-25": "Christmas Day"
        };

        Object.entries(fixedHolidays).forEach(([mmdd, name]) => {
            const [mm, dd] = mmdd.split('-').map(Number);
            if (mm - 1 === month) {
                implicit.push({
                    id: `implicit-holiday-${year}-${mm}-${dd}`,
                    title: name,
                    date: _formatDate(new Date(year, month, dd)),
                    type: 'holiday',
                    isImplicit: true
                });
            }
        });

        return implicit;
    };

    const _formatDate = (d) => {
        const offset = d.getTimezoneOffset();
        const date = new Date(d.getTime() - (offset * 60 * 1000));
        return date.toISOString().split('T')[0];
    }

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingEvent && !editingEvent.isImplicit) {
                // Delete old, create new (or proper PUT if you add put endpoint)
                await axios.delete(`${API_URL}/workspaces/${workspace.id}/calendar/${editingEvent.id}`);
            }
            await axios.post(`${API_URL}/workspaces/${workspace.id}/calendar/events`, formData);

            showToast("Event saved successfully", "success");
            setShowModal(false);
            fetchEvents();
        } catch (err) {
            showToast("Failed to save event", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this event?")) return;
        try {
            await axios.delete(`${API_URL}/workspaces/${workspace.id}/calendar/${id}`);
            showToast("Event deleted", "success");
            fetchEvents();
        } catch (err) {
            showToast("Failed to delete event", "error");
        }
    };

    const openModal = (event = null) => {
        if (event) {
            setFormData({ title: event.title, date: event.date, type: event.type });
            setEditingEvent(event);
        } else {
            setFormData({ title: '', date: _formatDate(new Date()), type: 'holiday' });
            setEditingEvent(null);
        }
        setShowModal(true);
    };

    // Calendar UI Setup
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const renderCalendarGrid = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        const days = [];
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Headers
        weekDays.forEach(day => {
            days.push(
                <div key={`header-${day}`} className="p-2 text-center text-xs font-bold text-gray-400 border-b border-white/10 uppercase tracking-widest">
                    {day}
                </div>
            );
        });

        // Blank days before month start
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`blank-${i}`} className="p-4 min-h-[100px] border-b border-r border-white/5 opacity-30"></div>);
        }

        // Days of month
        for (let d = 1; d <= daysInMonth; d++) {
            const currentDateStr = _formatDate(new Date(year, month, d));
            const dayEvents = events.filter(e => e.date === currentDateStr);
            const isToday = currentDateStr === _formatDate(new Date());

            days.push(
                <div key={`day-${d}`} className={`p-2 min-h-[100px] border-b border-r border-white/5 hover:bg-white/5 transition-colors group relative ${isToday ? 'bg-blue-900/20' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm ${isToday ? 'bg-blue-500 text-white font-bold' : 'text-gray-300'}`}>
                            {d}
                        </span>
                        <button
                            onClick={() => {
                                setFormData({ title: '', date: currentDateStr, type: 'event' });
                                setEditingEvent(null);
                                setShowModal(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white transition-opacity"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-1">
                        {dayEvents.map((evt, idx) => (
                            <div
                                key={idx}
                                onClick={() => !evt.isImplicit && openModal(evt)}
                                className={`text-[10px] p-1.5 rounded truncate bg-opacity-20 border group/event ${evt.type === 'holiday'
                                        ? 'bg-red-500 border-red-500/30 text-red-200 cursor-pointer'
                                        : 'bg-indigo-500 border-indigo-500/30 text-indigo-200 cursor-pointer'
                                    } ${evt.isImplicit ? 'cursor-default opacity-80 border-dashed' : 'hover:bg-opacity-40'}`}
                            >
                                <span className="flex justify-between items-center">
                                    <span>{evt.title}</span>
                                    {!evt.isImplicit && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(evt.id); }}
                                            className="opacity-0 group-hover/event:opacity-100 hover:text-white"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return days;
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <CalendarIcon className="w-6 h-6" /> Calendar & Holidays
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">Manage public holidays and institution events to guide scheduling.</p>
                </div>
                <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors cursor-pointer">
                    <Plus className="w-4 h-4" /> Add Event
                </button>
            </div>

            <div className="glass-card border border-white/10 rounded-2xl overflow-hidden p-6 mb-8">
                {/* Calendar Controls */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">
                        {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                            className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewDate(new Date())}
                            className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                            className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors cursor-pointer"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="h-[400px] flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                    </div>
                ) : (
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                        <div className="grid grid-cols-7 border-b border-white/10 bg-white/5">
                            {renderCalendarGrid().slice(0, 7)}
                        </div>
                        <div className="grid grid-cols-7">
                            {renderCalendarGrid().slice(7)}
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex gap-6 justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50 border border-red-500/30"></div>
                    <span className="text-sm text-gray-400">Holilay (No Exams)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500/50 border border-indigo-500/30"></div>
                    <span className="text-sm text-gray-400">Institution Event</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30 border-dashed"></div>
                    <span className="text-sm text-gray-400">Implicit Public Holiday</span>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-white/10 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-6">
                            {editingEvent ? "Edit Event" : "Create Event"}
                        </h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Title</label>
                                <input
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 transition-colors"
                                    required
                                    placeholder="E.g. Diwali / Tech Fest"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 transition-colors"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Type</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 transition-colors"
                                >
                                    <option value="holiday">Holiday (No Exams)</option>
                                    <option value="event">Institution Event</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Event"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarManager;
