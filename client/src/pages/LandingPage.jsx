import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, ArrowRight, Loader } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const LandingPage = () => {
    const navigate = useNavigate();
    const [mode, setMode] = useState('create'); // 'create' or 'join'
    const [roomId, setRoomId] = useState('');
    const [isAvailable, setIsAvailable] = useState(null); // null, true, false
    const [isChecking, setIsChecking] = useState(false);

    // Generate random ID on create mode
    useEffect(() => {
        if (mode === 'create') {
            const randomId = Math.random().toString(36).substring(2, 8);
            setRoomId(randomId);
            checkAvailability(randomId);
        } else {
            setRoomId('');
            setIsAvailable(null);
        }
    }, [mode]);

    const checkAvailability = useCallback(async (id) => {
        if (!id) {
            setIsAvailable(null);
            return;
        }
        setIsChecking(true);
        try {
            const resp = await axios.get(`${API_BASE}/rooms/check/${id}`);
            // If exists: false (not available), if not exists: true (available)
            setIsAvailable(!resp.data.exists);
        } catch (err) {
            console.error(err);
        } finally {
            setIsChecking(false);
        }
    }, []);

    const handleIdChange = (e) => {
        const val = e.target.value.replace(/[^a-zA-Z0-9-]/g, '');
        setRoomId(val);
        if (mode === 'create') {
            // Debounce check
            const timeoutId = setTimeout(() => checkAvailability(val), 500);
            return () => clearTimeout(timeoutId);
        }
    };

    const handleAction = async () => {
        if (!roomId) return;
        if (mode === 'create') {
            if (!isAvailable) return alert('Room ID not available');
            try {
                await axios.post(`${API_BASE}/rooms/create`, { roomId });
                navigate(`/${roomId}`);
            } catch (err) {
                alert('Error creating room');
            }
        } else {
            // Join
            navigate(`/${roomId}`);
        }
    };

    return (
        <div className="min-h-screen bg-[#1e1e1e] flex flex-col items-center justify-center text-[#cccccc] font-mono selection:bg-[#264f78] selection:text-white">
            <div className="w-full max-w-md p-8 bg-[#252526] border border-[#3e3e42] shadow-2xl">
                <div className="flex gap-6 mb-8 border-b border-[#3e3e42] pb-4">
                    <button
                        onClick={() => setMode('create')}
                        className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${mode === 'create' ? 'text-white border-b-2 border-white' : 'text-[#6e7681] hover:text-[#cccccc]'}`}
                    >
                        Create Room
                    </button>
                    <button
                        onClick={() => setMode('join')}
                        className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${mode === 'join' ? 'text-white border-b-2 border-white' : 'text-[#6e7681] hover:text-[#cccccc]'}`}
                    >
                        Join Room
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="relative">
                        <label className="block text-xs font-bold text-[#6e7681] uppercase mb-2">
                            {mode === 'create' ? 'Room ID (Editable)' : 'Enter Room ID'}
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={roomId}
                                onChange={handleIdChange}
                                placeholder="room-id"
                                className="w-full bg-[#111] border border-[#222] p-3 text-white focus:outline-none focus:border-[#444] transition-colors placeholder-[#444]"
                            />
                            {mode === 'create' && (
                                <div className="absolute right-3 top-[2.3rem]">
                                    {isChecking ? (
                                        <Loader className="w-4 h-4 text-[#444] animate-spin" />
                                    ) : isAvailable ? (
                                        <Check className="w-4 h-4 text-white" />
                                    ) : (
                                        <span className="text-white text-xs font-bold">TAKEN</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleAction}
                        disabled={mode === 'create' && !isAvailable}
                        className={`w-full py-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider transition-all
                            ${mode === 'create' && !isAvailable
                                ? 'bg-[#111] text-[#444] cursor-not-allowed'
                                : 'bg-white text-black hover:bg-[#ccc] shadow-lg'}`}
                    >
                        {mode === 'create' ? 'Initialize Environment' : 'Connect to Host'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="mt-8 text-xs text-[#6e7681] text-center">
                <p>LIVE CLIPBOARD • VS CODE THEME</p>
                <p className="mt-1">SECURE • FAST • MINIMAL</p>
            </div>
        </div>
    );
};

export default LandingPage;
