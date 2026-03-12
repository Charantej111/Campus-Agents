import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Users, AlertTriangle, CheckCircle, ChevronRight, ChevronDown, Download, Loader2, Plus, X, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const SEATING_MULTIPLIER = { Single: 1, Two: 2, Three: 3 };

// ─── Color palette for different courses ───
const COURSE_COLORS = [
    { bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.4)', text: '#38bdf8' },
    { bg: 'rgba(167, 139, 250, 0.18)', border: 'rgba(167, 139, 250, 0.4)', text: '#a78bfa' },
    { bg: 'rgba(244, 114, 182, 0.18)', border: 'rgba(244, 114, 182, 0.4)', text: '#f472b6' },
    { bg: 'rgba(52, 211, 153, 0.18)', border: 'rgba(52, 211, 153, 0.4)', text: '#34d399' },
    { bg: 'rgba(251, 191, 36, 0.18)', border: 'rgba(251, 191, 36, 0.4)', text: '#fbbf24' },
    { bg: 'rgba(248, 113, 113, 0.18)', border: 'rgba(248, 113, 113, 0.4)', text: '#f87171' },
];

const getCourseColor = (code, codeList) => {
    const idx = codeList.indexOf(code);
    return COURSE_COLORS[idx % COURSE_COLORS.length];
};


const AllocationAgentView = () => {
    const { workspace } = useAuth();

    // ── Data ──
    const [examCycles, setExamCycles] = useState([]);
    const [buildings, setBuildings] = useState([]);
    const [rooms, setRooms] = useState({});  // building_id -> rooms[]
    const [timetable, setTimetable] = useState([]);
    const [programs, setPrograms] = useState([]);

    // ── Form State ──
    const [selectedCycleId, setSelectedCycleId] = useState('');
    const [selectedExams, setSelectedExams] = useState([]);  // [{course_code, date, session, course_name}]
    const [examBuildingSelections, setExamBuildingSelections] = useState({});  // course_code -> [building_id]
    const [examRoomSelections, setExamRoomSelections] = useState({});  // course_code -> [room_id]
    const [customInstructions, setCustomInstructions] = useState('');

    // ── UI State ──
    const [step, setStep] = useState(1); // 1=select cycle, 2=select exams, 3=assign rooms, 4=results
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [expandedExam, setExpandedExam] = useState(null);

    // ── Fetch on mount ──
    useEffect(() => {
        if (workspace) {
            fetchExamCycles();
            fetchBuildings();
            fetchPrograms();
        }
    }, [workspace]);

    const fetchExamCycles = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/exam_cycles`);
            setExamCycles(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchBuildings = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/buildings`);
            setBuildings(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchPrograms = async () => {
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/programs`);
            setPrograms(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchRoomsForBuilding = async (buildingId) => {
        if (rooms[buildingId]) return;
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/buildings/${buildingId}/rooms`);
            setRooms(prev => ({ ...prev, [buildingId]: res.data }));
        } catch (err) { console.error(err); }
    };

    const loadTimetable = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/workspaces/${workspace.id}/exam_plan`);
            if (res.data?.timetable?.length > 0) {
                setTimetable(res.data.timetable);
                setStep(2);
            } else {
                setError("No saved timetable found. Run the Scheduling Agent first.");
            }
        } catch (err) {
            setError("Failed to load timetable. Run the Scheduling Agent first.");
        } finally {
            setLoading(false);
        }
    };

    // ── Handlers ──
    const handleCycleSelect = (cycleId) => {
        setSelectedCycleId(cycleId);
        setSelectedExams([]);
        setExamBuildingSelections({});
        setExamRoomSelections({});
        setResult(null);
    };

    const toggleExamSelection = (entry) => {
        const key = entry.course_code;
        setSelectedExams(prev => {
            const exists = prev.find(e => e.course_code === key);
            if (exists) {
                return prev.filter(e => e.course_code !== key);
            }
            return [...prev, { course_code: entry.course_code, date: entry.date, session: entry.session, course_name: entry.course_name }];
        });
    };

    const toggleBuildingForExam = (courseCode, buildingId) => {
        setExamBuildingSelections(prev => {
            const current = prev[courseCode] || [];
            const updated = current.includes(buildingId)
                ? current.filter(b => b !== buildingId)
                : [...current, buildingId];
            return { ...prev, [courseCode]: updated };
        });
        // Fetch rooms for the building
        fetchRoomsForBuilding(buildingId);
    };

    const toggleRoomForExam = (courseCode, roomId) => {
        setExamRoomSelections(prev => {
            const current = prev[courseCode] || [];
            const updated = current.includes(roomId)
                ? current.filter(r => r !== roomId)
                : [...current, roomId];
            return { ...prev, [courseCode]: updated };
        });
    };

    const getProgramName = (pid) => {
        const p = programs.find(prog => (prog._id || prog.id) === pid);
        return p ? p.name : pid;
    };

    // ── Submit ──
    const handleAllocate = async () => {
        if (!selectedCycleId) { setError("Select an exam cycle"); return; }
        if (selectedExams.length === 0) { setError("Select at least one exam"); return; }

        // Validate room selections
        for (const exam of selectedExams) {
            const roomIds = examRoomSelections[exam.course_code] || [];
            if (roomIds.length === 0) {
                setError(`Select at least one room for ${exam.course_code} (${exam.course_name})`);
                return;
            }
        }

        setLoading(true);
        setError(null);

        // Build room_assignments
        const roomAssignmentMap = {};  // room_id -> {room_id, building_id, course_codes}
        for (const exam of selectedExams) {
            const roomIds = examRoomSelections[exam.course_code] || [];
            const buildingIds = examBuildingSelections[exam.course_code] || [];
            for (const rid of roomIds) {
                if (!roomAssignmentMap[rid]) {
                    // Find building_id for this room
                    let bid = '';
                    for (const b of buildingIds) {
                        if (rooms[b] && rooms[b].find(r => r.id === rid)) {
                            bid = b;
                            break;
                        }
                    }
                    roomAssignmentMap[rid] = { room_id: rid, building_id: bid, course_codes: [] };
                }
                if (!roomAssignmentMap[rid].course_codes.includes(exam.course_code)) {
                    roomAssignmentMap[rid].course_codes.push(exam.course_code);
                }
            }
        }

        const payload = {
            workspace_id: workspace.id,
            exam_cycle_id: selectedCycleId,
            exams: selectedExams.map(e => ({ course_code: e.course_code, date: e.date, session: e.session })),
            room_assignments: Object.values(roomAssignmentMap),
            custom_instructions: customInstructions
        };

        try {
            const res = await axios.post(`${API_URL}/exam/allocate`, payload);
            setResult(res.data);
            setStep(4);
        } catch (err) {
            setError(err.response?.data?.detail || "Allocation failed");
        } finally {
            setLoading(false);
        }
    };

    // ── PDF Download ──
    const handleDownloadPDF = (roomAlloc) => {
        // Generate a printable HTML and trigger print
        const seating = SEATING_MULTIPLIER[roomAlloc.seating_type] || 1;
        const allCourseCodes = roomAlloc.course_codes || [];

        // Build seat grid map
        const seatMap = {};
        for (const sa of roomAlloc.allocations) {
            const key = `${sa.bench_index}-${sa.seat_position}`;
            seatMap[key] = sa;
        }

        let gridHtml = '';
        for (let r = 0; r < roomAlloc.rows; r++) {
            gridHtml += '<tr>';
            gridHtml += `<td style="padding:4px 8px;font-weight:bold;color:#666;text-align:center;">${String.fromCharCode(65 + r)}</td>`;
            for (let c = 0; c < roomAlloc.columns; c++) {
                let benchHtml = '<div style="display:flex;gap:2px;border:1px solid #ddd;border-radius:4px;padding:3px;">';
                for (let s = 0; s < seating; s++) {
                    const sa = seatMap[`${c}-${s}`];
                    const row_allocs = roomAlloc.allocations.filter(a => a.bench_index === c && a.seat_position === s);
                    // Find allocation for this row
                    const alloc = roomAlloc.allocations.find(a => {
                        const rl = String.fromCharCode(65 + r);
                        return a.seat_label === `${rl}${c * seating + s + 1}`;
                    });
                    if (alloc) {
                        const colorIdx = allCourseCodes.indexOf(alloc.course_code) % COURSE_COLORS.length;
                        benchHtml += `<div style="width:60px;height:40px;background:#e8f4f8;border:1px solid #b0d4e8;border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:8px;">
                            <strong>${alloc.student_id}</strong>
                            <span style="font-size:7px;color:#666;">${alloc.course_code}</span>
                        </div>`;
                    } else {
                        benchHtml += '<div style="width:60px;height:40px;background:#f5f5f5;border:1px dashed #ddd;border-radius:3px;"></div>';
                    }
                }
                benchHtml += '</div>';
                gridHtml += `<td style="padding:4px;">${benchHtml}</td>`;
            }
            gridHtml += '</tr>';
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.body.innerHTML = `
            <html><head><title>Seat Allocation - Room ${roomAlloc.room_id}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
                h1 { font-size: 18px; margin-bottom: 4px; }
                .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
                table { border-collapse: collapse; }
                td { vertical-align: top; }
                .courses { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
                .course-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; border: 1px solid #ccc; }
            </style></head><body>
            <h1>Room ${roomAlloc.room_id} — ${roomAlloc.room_name}</h1>
            <div class="meta">
                Building: ${roomAlloc.building_id} | Floor: ${roomAlloc.floor_id} | 
                Date: ${roomAlloc.exam_date} | Session: ${roomAlloc.exam_session} |
                Seating: ${roomAlloc.seating_type} | Occupied: ${roomAlloc.occupied_seats}/${roomAlloc.total_seats}
            </div>
            <div class="meta">
                Programs: ${roomAlloc.program_ids.map(pid => getProgramName(pid)).join(', ')} | Batches: ${roomAlloc.batch_years.join(', ')}
            </div>
            <div class="courses">
                ${allCourseCodes.map((c, i) => {
            const name = roomAlloc.course_names[i] || c;
            return `<span class="course-tag">${c}: ${name}</span>`;
        }).join('')}
            </div>
            <table>${gridHtml}</table>
            <script>window.onload = () => window.print();</script>
            </body></html>
        `;
        printWindow.print();
        printWindow.document.close();
    };

    // ── RENDER ──
    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            {/* Header */}
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
                    <p className="text-base text-white/60 mb-2 max-w-2xl">
                        Anti-cheating seat allocation system. Students are interleaved across different courses and batches to minimize cheating.
                    </p>

                    {/* Step indicator */}
                    <div className="flex items-center gap-2 mt-4">
                        {['Select Cycle & Exams', 'Assign Rooms', 'Review & Generate', 'Results'].map((label, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 ? 'bg-green-500/30 text-green-400 border border-green-500/40' :
                                        step === i + 1 ? 'bg-purple-500/30 text-purple-400 border border-purple-500/40' :
                                            'bg-white/5 text-white/30 border border-white/10'
                                    }`}>
                                    {step > i + 1 ? '✓' : i + 1}
                                </div>
                                <span className={`text-xs hidden md:inline ${step === i + 1 ? 'text-purple-400 font-medium' : 'text-white/30'}`}>{label}</span>
                                {i < 3 && <ChevronRight className="w-3 h-3 text-white/20" />}
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* ───── STEP 1 & 2: Select Cycle, Load Timetable, Pick Exams ───── */}
            {step <= 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 rounded-2xl border border-white/10 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Exam Cycle</label>
                            <select
                                value={selectedCycleId}
                                onChange={e => handleCycleSelect(e.target.value)}
                                className="w-full glass-card border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                            >
                                <option value="" className="text-gray-900">Select Exam Cycle</option>
                                {examCycles.map(c => (
                                    <option key={c._id || c.id} value={c._id || c.id} className="text-gray-900">
                                        {c.name} (Sem-{c.semester}, Batch {c.batch_year})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <motion.button
                                onClick={loadTimetable}
                                disabled={!selectedCycleId || loading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="bg-purple-600/80 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                Load Timetable
                            </motion.button>
                        </div>
                    </div>

                    {/* Exam list from timetable */}
                    {timetable.length > 0 && (
                        <div>
                            <h3 className="text-white font-semibold mb-3">Select Exams to Allocate</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2">
                                {timetable.map((entry, i) => {
                                    const isSelected = selectedExams.find(e => e.course_code === entry.course_code);
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => toggleExamSelection(entry)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                                    ? 'bg-purple-500/20 border-purple-500/40'
                                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-white font-medium text-sm">{entry.course_name || entry.course_code}</div>
                                                    <div className="text-white/40 text-xs font-mono">{entry.course_code}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-white/50 text-xs">{entry.date}</div>
                                                    <div className="text-purple-400 text-xs">{entry.session}</div>
                                                </div>
                                            </div>
                                            {entry.program_ids && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {entry.program_ids.map(pid => (
                                                        <span key={pid} className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                                                            {getProgramName(pid)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedExams.length > 0 && (
                                <div className="flex justify-end mt-4">
                                    <motion.button
                                        onClick={() => setStep(3)}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-500/30"
                                    >
                                        Next: Assign Rooms <ChevronRight className="w-4 h-4" />
                                    </motion.button>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            )}

            {/* ───── STEP 3: Assign Rooms per Exam ───── */}
            {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <button onClick={() => setStep(2)} className="text-white/50 hover:text-white text-sm flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" /> Back to exam selection
                    </button>

                    {selectedExams.map(exam => {
                        const isExpanded = expandedExam === exam.course_code;
                        const selectedBldgs = examBuildingSelections[exam.course_code] || [];
                        const selectedRms = examRoomSelections[exam.course_code] || [];

                        return (
                            <div key={exam.course_code} className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                                <div
                                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => setExpandedExam(isExpanded ? null : exam.course_code)}
                                >
                                    <div className="flex items-center gap-3">
                                        {isExpanded ? <ChevronDown className="w-5 h-5 text-purple-400" /> : <ChevronRight className="w-5 h-5 text-white/40" />}
                                        <div>
                                            <div className="text-white font-semibold">{exam.course_name || exam.course_code}</div>
                                            <div className="text-white/40 text-xs font-mono">{exam.course_code} · {exam.date} · {exam.session}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">{selectedBldgs.length} buildings</span>
                                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">{selectedRms.length} rooms</span>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 border-t border-white/10 space-y-4">
                                        {/* Building selection */}
                                        <div>
                                            <label className="text-xs text-white/50 mb-2 block uppercase tracking-wider">Select Buildings</label>
                                            <div className="flex flex-wrap gap-2">
                                                {buildings.map(b => {
                                                    const selected = selectedBldgs.includes(b.id);
                                                    return (
                                                        <button
                                                            key={b.id}
                                                            onClick={() => toggleBuildingForExam(exam.course_code, b.id)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selected
                                                                    ? 'bg-blue-500/30 text-blue-400 border border-blue-500/40'
                                                                    : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'
                                                                }`}
                                                        >
                                                            {b.name} ({b.id})
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Room selection per building */}
                                        {selectedBldgs.map(bId => {
                                            const buildingRooms = rooms[bId] || [];
                                            const bldg = buildings.find(b => b.id === bId);
                                            return (
                                                <div key={bId} className="bg-black/20 rounded-lg p-3 border border-white/5">
                                                    <div className="text-xs text-white/40 mb-2 font-medium">{bldg?.name || bId} — Rooms</div>
                                                    {buildingRooms.length === 0 ? (
                                                        <div className="text-xs text-white/30 italic">Loading rooms...</div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {buildingRooms.map(r => {
                                                                const selected = selectedRms.includes(r.id);
                                                                return (
                                                                    <button
                                                                        key={r.id}
                                                                        onClick={() => toggleRoomForExam(exam.course_code, r.id)}
                                                                        className={`px-3 py-2 rounded-lg text-xs transition-all flex flex-col items-start ${selected
                                                                                ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                                                                                : 'bg-white/5 text-white/50 border border-white/10 hover:border-white/20'
                                                                            }`}
                                                                    >
                                                                        <span className="font-bold">{r.id} — {r.name}</span>
                                                                        <span className="text-[10px] opacity-70">{r.rows}×{r.columns} · {r.seating_type} · {r.capacity} seats</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Custom instructions */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10">
                        <label className="block text-sm font-medium text-white/70 mb-2">Custom Instructions (Optional)</label>
                        <textarea
                            value={customInstructions}
                            onChange={e => setCustomInstructions(e.target.value)}
                            rows={3}
                            className="w-full glass-card border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 placeholder:text-white/30"
                            placeholder="E.g., Keep CSE students in Room 101, prioritize senior batches in front rows..."
                        />
                    </div>

                    <div className="flex justify-between">
                        <button onClick={() => setStep(2)} className="text-white/50 hover:text-white text-sm flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <motion.button
                            onClick={handleAllocate}
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-500/30"
                        >
                            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Allocating...</> : <><Users className="w-5 h-5" /> Generate Allocation</>}
                        </motion.button>
                    </div>
                </motion.div>
            )}

            {/* ───── STEP 4: Results ───── */}
            {step === 4 && result && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <button onClick={() => setStep(3)} className="text-white/50 hover:text-white text-sm flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" /> Back to configuration
                    </button>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Status" value={result.status} icon={result.status === 'complete' ? <CheckCircle className="text-green-400" /> : <AlertTriangle className="text-yellow-400" />} />
                        <StatCard label="Rooms Used" value={result.room_allocations?.length || 0} icon={<Users className="text-blue-400" />} />
                        <StatCard label="Total Allocated" value={result.room_allocations?.reduce((s, r) => s + r.occupied_seats, 0) || 0} />
                        <StatCard label="Conflicts" value={result.conflicts?.length || 0} color={result.conflicts?.length > 0 ? "text-red-400" : "text-green-400"} />
                    </div>

                    {/* Errors */}
                    {result.errors?.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
                            <h3 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Errors</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}
                    {result.conflicts?.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-4 rounded-lg">
                            <h3 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Warnings</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                {result.conflicts.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* Room Allocation Grids */}
                    {result.room_allocations?.map((roomAlloc, rIdx) => (
                        <RoomAllocationCard
                            key={rIdx}
                            roomAlloc={roomAlloc}
                            onDownload={() => handleDownloadPDF(roomAlloc)}
                        />
                    ))}
                </motion.div>
            )}
        </div>
    );
};


// ─── Room Allocation Visual Card ───
const RoomAllocationCard = ({ roomAlloc, onDownload }) => {
    const seating = SEATING_MULTIPLIER[roomAlloc.seating_type] || 1;
    const allCourseCodes = roomAlloc.course_codes || [];

    // Build seat lookup: `row-bench-pos` -> allocation
    const seatLookup = useMemo(() => {
        const map = {};
        for (const sa of roomAlloc.allocations) {
            map[sa.seat_label] = sa;
        }
        return map;
    }, [roomAlloc.allocations]);

    return (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-black/20 flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h3 className="text-white font-bold text-lg">
                        Room {roomAlloc.room_id} — {roomAlloc.room_name}
                    </h3>
                    <div className="text-white/40 text-xs flex flex-wrap gap-3 mt-1">
                        <span>Building: {roomAlloc.building_id}</span>
                        <span>Floor: {roomAlloc.floor_id}</span>
                        <span>Date: {roomAlloc.exam_date}</span>
                        <span>Session: {roomAlloc.exam_session}</span>
                        <span>{roomAlloc.seating_type} seating</span>
                        <span>{roomAlloc.occupied_seats}/{roomAlloc.total_seats} seated</span>
                    </div>
                </div>
                <motion.button
                    onClick={onDownload}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-emerald-600/80 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                    <Download className="w-4 h-4" /> Print / PDF
                </motion.button>
            </div>

            {/* Course tags */}
            <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-white/5">
                {allCourseCodes.map((code, i) => {
                    const color = getCourseColor(code, allCourseCodes);
                    const name = roomAlloc.course_names?.[i] || code;
                    return (
                        <span key={code} style={{ background: color.bg, borderColor: color.border, color: color.text }} className="text-xs px-2 py-1 rounded border">
                            {code}: {name}
                        </span>
                    );
                })}
                <span className="text-xs text-white/30 px-2 py-1">
                    Batches: {roomAlloc.batch_years?.join(', ')}
                </span>
            </div>

            {/* Seat Grid */}
            <div className="p-4 overflow-x-auto">
                <table className="mx-auto" style={{ borderCollapse: 'separate', borderSpacing: '4px' }}>
                    <thead>
                        <tr>
                            <th></th>
                            {Array.from({ length: roomAlloc.columns }, (_, c) => (
                                <th key={c} className="text-center text-[10px] text-white/20 font-mono pb-1">C{c + 1}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: roomAlloc.rows }, (_, r) => {
                            const rowLetter = String.fromCharCode(65 + r);
                            return (
                                <tr key={r}>
                                    <td className="text-[10px] text-white/20 font-mono pr-2 text-center font-bold">{rowLetter}</td>
                                    {Array.from({ length: roomAlloc.columns }, (_, c) => (
                                        <td key={c}>
                                            <div className={`flex gap-[2px] rounded border ${seating === 1 ? 'border-transparent' : 'border-white/5 p-[2px]'
                                                }`}>
                                                {Array.from({ length: seating }, (_, s) => {
                                                    const label = `${rowLetter}${c * seating + s + 1}`;
                                                    const alloc = seatLookup[label];
                                                    if (alloc) {
                                                        const color = getCourseColor(alloc.course_code, allCourseCodes);
                                                        return (
                                                            <div
                                                                key={s}
                                                                style={{ background: color.bg, borderColor: color.border }}
                                                                className="w-[56px] h-[40px] rounded border flex flex-col items-center justify-center cursor-default group relative"
                                                                title={`${alloc.student_id} - ${alloc.student_name} (${alloc.course_code}, Batch ${alloc.batch_year})`}
                                                            >
                                                                <span className="text-[9px] font-bold text-white truncate max-w-[50px]">{alloc.student_id}</span>
                                                                <span className="text-[7px] truncate max-w-[50px]" style={{ color: color.text }}>{alloc.course_code}</span>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div key={s} className="w-[56px] h-[40px] rounded border border-dashed border-white/10 bg-white/[0.02]" />
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-3 border-t border-white/5 flex flex-wrap gap-4 text-[10px] text-white/30 uppercase tracking-wider">
                <span className="flex items-center gap-1"><div className="w-[10px] h-[10px] rounded bg-white/5 border border-dashed border-white/10"></div> Empty</span>
                {allCourseCodes.map(code => {
                    const color = getCourseColor(code, allCourseCodes);
                    return (
                        <span key={code} className="flex items-center gap-1">
                            <div className="w-[10px] h-[10px] rounded" style={{ background: color.bg, border: `1px solid ${color.border}` }}></div>
                            {code}
                        </span>
                    );
                })}
            </div>
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


export default AllocationAgentView;
