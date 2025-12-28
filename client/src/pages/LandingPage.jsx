import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, ArrowRight, Loader, Sun, Moon } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const LandingPage = () => {
    const navigate = useNavigate();
    const [mode, setMode] = useState('create'); // 'create' or 'join'
    const [roomId, setRoomId] = useState('');
    const [isAvailable, setIsAvailable] = useState(null); // null, true, false
    const [isChecking, setIsChecking] = useState(false);

    const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('theme') || 'light');

    useEffect(() => {
        document.documentElement.dataset.theme = currentTheme;
        localStorage.setItem('theme', currentTheme);
    }, [currentTheme]);

    const toggleTheme = () => {
        setCurrentTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

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
        <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary font-sans selection:bg-text-primary selection:text-bg-primary transition-colors duration-500">
            <div className="w-full max-w-sm p-10 bg-bg-primary border border-border-color shadow-2xl relative overflow-hidden group">
                <div className="absolute top-4 right-4 z-50">
                    <button onClick={toggleTheme} className="p-2 hover:opacity-50 transition-opacity">
                        {currentTheme === 'light' ? <Moon className="w-5 h-5 text-text-primary" /> : <Sun className="w-5 h-5 text-text-primary" />}
                    </button>
                </div>

                <div className="absolute top-0 left-0 w-full h-1 bg-text-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

                <div className="flex gap-8 mb-10 border-b border-border-color pb-4 justify-center">
                    <button
                        onClick={() => setMode('create')}
                        className={`pb-2 text-xs font-black uppercase tracking-[0.2em] transition-all hover:text-text-primary ${mode === 'create' ? 'text-text-primary border-b-2 border-text-primary' : 'text-text-secondary border-transparent'}`}
                    >
                        Create
                    </button>
                    <button
                        onClick={() => setMode('join')}
                        className={`pb-2 text-xs font-black uppercase tracking-[0.2em] transition-all hover:text-text-primary ${mode === 'join' ? 'text-text-primary border-b-2 border-text-primary' : 'text-text-secondary border-transparent'}`}
                    >
                        Join
                    </button>
                </div>

                <div className="space-y-8">
                    <div className="relative group/input">
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-3">
                            {mode === 'create' ? 'Project Identifier' : 'Destination ID'}
                        </label>
                        <div className="flex items-center gap-2 relative">
                            <input
                                type="text"
                                value={roomId}
                                onChange={handleIdChange}
                                placeholder="ID"
                                className="w-full bg-bg-primary border-b border-border-color py-3 text-lg font-mono text-text-primary focus:outline-none focus:border-text-primary transition-colors placeholder-text-secondary/20"
                            />
                            {mode === 'create' && (
                                <div className="absolute right-0 top-3">
                                    {isChecking ? (
                                        <Loader className="w-4 h-4 text-text-secondary animate-spin" />
                                    ) : isAvailable ? (
                                        <Check className="w-4 h-4 text-text-primary" />
                                    ) : (
                                        <span className="text-text-primary text-[9px] font-black tracking-widest bg-text-primary text-bg-primary px-1">TAKEN</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleAction}
                        disabled={mode === 'create' && !isAvailable}
                        className={`w-full py-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.25em] transition-all duration-300 border border-text-primary
                            ${mode === 'create' && !isAvailable
                                ? 'opacity-50 cursor-not-allowed bg-transparent text-text-secondary'
                                : 'bg-text-primary text-bg-primary hover:bg-bg-primary hover:text-text-primary'}`}
                    >
                        {mode === 'create' ? 'Initialize' : 'Connect'}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="mt-12 flex flex-col items-center gap-2 text-[9px] font-bold text-text-secondary uppercase tracking-[0.3em]">
                <p>Live Clipboard <span className="mx-2">•</span> B&W</p>
                <div className="w-px h-8 bg-border-color my-2"></div>
                <p>Secure <span className="mx-2">/</span> Minimal <span className="mx-2">/</span> Fast</p>
            </div>
        </div>
    );
};

export default LandingPage;
