import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, Calendar, Clock, Building2, Armchair } from 'lucide-react';

const SeatVisualization = ({ allocations, rooms, timetable, buildings }) => {
    const [selectedExam, setSelectedExam] = useState(timetable[0]?.course_code || "");
    const [hoveredSeat, setHoveredSeat] = useState(null);

    React.useEffect(() => {
        if (timetable && timetable.length > 0 && !timetable.find(t => t.course_code === selectedExam)) {
            setSelectedExam(timetable[0]?.course_code || "");
        } else if (!selectedExam && timetable && timetable.length > 0) {
            setSelectedExam(timetable[0]?.course_code);
        }
    }, [timetable]);

    const examAllocations = allocations.filter(a => a.exam_course_code === selectedExam);
    const usedRoomIds = [...new Set(examAllocations.map(a => a.room_id))];
    const selectedExamData = timetable.find(t => t.course_code === selectedExam);

    return (
        <div className="p-8 space-y-8 relative">
            {/* Exam Selector - Cinema Ticket Style */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 rounded-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <Calendar className="w-5 h-5 text-indigo-400" />
                            </div>
                            <h3 className="text-2xl font-display font-bold text-white">Select Examination</h3>
                        </div>
                        
                        <select
                            value={selectedExam}
                            onChange={(e) => setSelectedExam(e.target.value)}
                            className="w-full md:w-auto bg-black/40 border border-white/20 rounded-xl px-6 py-3 text-white font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer hover:bg-black/60"
                        >
                            {timetable.map(t => (
                                <option key={t.course_code} value={t.course_code} className="bg-gray-900">
                                    {t.course_code} - {t.course_name || "Unknown"}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedExamData && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-wrap gap-3"
                        >
                            <div className="glass-card px-4 py-2 rounded-lg flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-400" />
                                <span className="text-sm font-mono text-white/80">{selectedExamData.date}</span>
                            </div>
                            <div className="glass-card px-4 py-2 rounded-lg flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-400" />
                                <span className="text-sm font-mono text-white/80">{selectedExamData.start_time}</span>
                            </div>
                            <div className="glass-card px-4 py-2 rounded-lg flex items-center gap-2">
                                <User className="w-4 h-4 text-pink-400" />
                                <span className="text-sm font-mono text-white/80">{examAllocations.length} Students</span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>

            {/* Room Grid - Theatre Style */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {usedRoomIds.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full glass-card p-16 rounded-2xl text-center"
                    >
                        <Armchair className="w-16 h-16 text-white/20 mx-auto mb-4" />
                        <p className="text-white/40 text-lg">No seat allocations found for this examination.</p>
                    </motion.div>
                ) : (
                    usedRoomIds.map((roomId, idx) => {
                        const room = rooms.find(h => h.id === roomId);
                        const roomAllocs = examAllocations.filter(a => a.room_id === roomId);

                        return (
                            <motion.div
                                key={roomId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <TheatreRoomView
                                    room={room || { id: roomId, name: `Room ${roomId}`, capacity: 30 }}
                                    allocations={roomAllocs}
                                    buildings={buildings}
                                    onSeatHover={setHoveredSeat}
                                />
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Floating Seat Details Tooltip */}
            <AnimatePresence>
                {hoveredSeat && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 glass-card p-4 rounded-xl border-2 border-indigo-500/50 min-w-[280px] glow-border"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <User className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <div className="font-display font-bold text-white text-lg">{hoveredSeat.student}</div>
                                <div className="text-sm text-white/60 font-mono mt-1">Seat: {hoveredSeat.seat}</div>
                                <div className="text-xs text-white/40 mt-1">{hoveredSeat.room}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Legend */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-6 rounded-2xl"
            >
                <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 border border-white/20"></div>
                        <span className="text-white/70 font-medium">Occupied</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10"></div>
                        <span className="text-white/70 font-medium">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Armchair className="w-5 h-5 text-indigo-400" />
                        <span className="text-white/70 font-medium">Hover for details</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const TheatreRoomView = ({ room, allocations, buildings, onSeatHover }) => {
    const buildingName = buildings?.find(b => b.id === room.building_id)?.name || room.building_id || "Unknown Building";
    const columns = room.columns || 6;
    const capacity = room.capacity || 30;

    const seats = Array.from({ length: capacity }, (_, i) => {
        const seatNum = i + 1;
        const seatLabel = `S-${seatNum}`;
        const alloc = allocations.find(a => a.seat_number === seatLabel);
        return {
            number: seatNum,
            label: seatLabel,
            student: alloc ? alloc.student_id : null,
            row: Math.floor(i / columns),
            col: i % columns
        };
    });

    return (
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
            
            {/* Header */}
            <div className="mb-6 pb-4 border-b border-white/10">
                <div className="flex items-start justify-between">
                    <div>
                        <h4 className="font-display font-bold text-2xl text-white mb-1">{room.name}</h4>
                        <div className="flex items-center gap-2 text-sm">
                            <Building2 className="w-4 h-4 text-purple-400" />
                            <span className="text-purple-400 font-medium">{buildingName}</span>
                            <span className="text-white/30">•</span>
                            <span className="text-white/50 font-mono">{room.id}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-display font-bold text-gradient">{allocations.length}</div>
                        <div className="text-xs text-white/40 uppercase tracking-wider">Allocated</div>
                    </div>
                </div>
            </div>

            {/* Screen/Stage */}
            <div className="mb-8 relative">
                <div className="w-full h-12 bg-gradient-to-b from-white/10 to-transparent rounded-t-3xl border-t border-x border-white/20 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                    <span className="text-white/30 uppercase tracking-[0.3em] text-xs font-display font-bold relative z-10">Examination Room Front</span>
                </div>
                <div className="h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
            </div>

            {/* Seat Grid */}
            <div 
                className="grid gap-3 mb-6" 
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
                {seats.map((seat, idx) => (
                    <motion.div
                        key={seat.number}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.01 }}
                        onMouseEnter={() => seat.student && onSeatHover({ 
                            student: seat.student, 
                            seat: seat.label,
                            room: room.name 
                        })}
                        onMouseLeave={() => onSeatHover(null)}
                        className={`
                            aspect-square rounded-xl p-2 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer relative overflow-hidden
                            ${seat.student
                                ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-2 border-indigo-500/50 hover:border-indigo-400 hover:scale-110 hover:shadow-lg hover:shadow-indigo-500/50'
                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                            }
                        `}
                    >
                        {seat.student && (
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 animate-pulse"></div>
                        )}
                        
                        <div className="relative z-10 w-full">
                            <Armchair className={`w-4 h-4 mx-auto mb-1 ${seat.student ? 'text-indigo-300' : 'text-white/20'}`} />
                            <span className={`text-[9px] font-mono block ${seat.student ? 'text-white/90 font-bold' : 'text-white/30'}`}>
                                {seat.student ? seat.student.substring(0, 8) : seat.label}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Stats Footer */}
            <div className="flex items-center justify-between text-xs pt-4 border-t border-white/10">
                <div className="flex items-center gap-4">
                    <span className="text-white/40">Capacity: <span className="text-white font-bold">{capacity}</span></span>
                    <span className="text-white/40">Layout: <span className="text-white font-mono">{columns}×{Math.ceil(capacity / columns)}</span></span>
                </div>
                <div className="text-white/40">
                    Utilization: <span className="text-gradient font-bold">{Math.round((allocations.length / capacity) * 100)}%</span>
                </div>
            </div>
        </div>
    );
};

export default SeatVisualization;
