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
        <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary font-mono selection:bg-text-primary selection:text-bg-primary transition-colors duration-300">
            <div className="w-full max-w-md p-8 bg-bg-secondary border border-border-color shadow-none">
                <div className="flex gap-6 mb-8 border-b border-border-color pb-4">
                    <button
                        onClick={() => setMode('create')}
                        className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${mode === 'create' ? 'text-text-primary border-b-2 border-text-primary' : 'text-text-primary opacity-40 hover:opacity-100'}`}
                    >
                        Create Room
                    </button>
                    <button
                        onClick={() => setMode('join')}
                        className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors ${mode === 'join' ? 'text-text-primary border-b-2 border-text-primary' : 'text-text-primary opacity-40 hover:opacity-100'}`}
                    >
                        Join Room
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="relative">
                        <label className="block text-xs font-bold text-text-primary opacity-60 uppercase mb-2">
                            {mode === 'create' ? 'Room ID (Editable)' : 'Enter Room ID'}
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={roomId}
                                onChange={handleIdChange}
                                placeholder="room-id"
                                className="w-full bg-bg-primary border border-border-color p-3 text-text-primary focus:outline-none focus:border-text-primary transition-colors placeholder-text-primary/30"
                            />
                            {mode === 'create' && (
                                <div className="absolute right-3 top-[2.3rem]">
                                    {isChecking ? (
                                        <Loader className="w-4 h-4 text-text-primary animate-spin" />
                                    ) : isAvailable ? (
                                        <Check className="w-4 h-4 text-text-primary" />
                                    ) : (
                                        <span className="text-text-primary text-xs font-bold">TAKEN</span>
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
                                ? 'bg-bg-primary text-text-primary opacity-50 cursor-not-allowed border border-border-color'
                                : 'bg-text-primary text-bg-primary hover:opacity-80'}`}
                    >
                        {mode === 'create' ? 'Initialize Environment' : 'Connect to Host'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="mt-8 text-xs text-text-primary opacity-40 text-center uppercase tracking-widest">
                <p>LIVE CLIPBOARD • B&W EDITION</p>
                <p className="mt-1">SECURE • FAST • MINIMAL</p>
            </div>
        </div>
    );
};

export default LandingPage;
