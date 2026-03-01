import React from 'react';
import { ArrowLeft, User } from 'lucide-react';

const RoomView = ({ room, building, onBack }) => {
    // Generate simple grid based on capacity (assume 6 columns)
    const cols = 6;
    const rows = Math.ceil(room.capacity / cols);
    const seats = Array.from({ length: room.capacity }, (_, i) => ({
        id: `${String.fromCharCode(65 + Math.floor(i / cols))}-${(i % cols) + 1}`,
        status: 'available' // Mock status for now
    }));

    return (
        <div className="animate-in zoom-in-95 duration-500 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm uppercase tracking-widest">Return to Building</span>
                </button>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-white">{room.name}</h2>
                    <p className="text-purple-400 font-mono text-sm">{building.name} • {room.id}</p>
                </div>
            </div>

            {/* Stage / Front */}
            <div className="w-full flex justify-center mb-12 perspecitve-1000">
                <div className="w-2/3 h-12 bg-white/5 border-b border-white/10 rounded-lg transform -skew-x-12 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    <span className="text-white/20 uppercase tracking-[0.5em] text-sm">Validus Podium</span>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto pr-4">
                <div
                    className="grid gap-4 mx-auto pb-10"
                    style={{
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        maxWidth: '600px'
                    }}
                >
                    {seats.map((seat) => (
                        <div
                            key={seat.id}
                            className="group relative aspect-square bg-gray-800/80 hover:bg-purple-600/20 border border-white/5 hover:border-purple-500/50 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:-translate-y-1"
                        >
                            <div className="w-2 h-2 rounded-full bg-emerald-500/50 mb-2 shadow-[0_0_5px_currentColor]"></div>
                            <span className="text-xs text-gray-500 group-hover:text-white font-mono">{seat.id}</span>

                            {/* Hover Tooltip (Simulated "Student Details") */}
                            <div className="absolute bottom-full mb-2 bg-black/90 border border-white/10 rounded px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10 hidden group-hover:block">
                                Seat {seat.id} <br /> <span className="text-emerald-400">Available</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 text-xs text-gray-500 uppercase tracking-wider py-4 border-t border-white/5">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_currentColor]"></div> Available</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_currentColor]"></div> Occupied</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_currentColor]"></div> Selected</div>
            </div>
        </div>
    );
};

export default RoomView;
