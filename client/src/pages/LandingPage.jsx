import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, ArrowRight, Loader2, Sun, Moon, Plus, Link as LinkIcon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute top-6 left-6 z-50"
            >
                <LinkIcon className="w-6 h-6" />
            </motion.div>
            {/* Theme Toggle */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={toggleTheme}
                className="absolute top-6 right-6 p-3 rounded-full hover:bg-border-color/50 transition-colors text-text-primary z-50"
            >
                {currentTheme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </motion.button>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-md bg-bg-primary border border-border-color shadow-2xl rounded-3xl p-8 md:p-10 relative overflow-hidden z-10"
            >
                {/* Header */}
                <div className="mb-10 text-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.5 }}
                        className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-text-primary text-bg-primary mb-4 shadow-lg"
                    >
                        <Sparkles className="w-6 h-6" />
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl font-bold tracking-tight text-text-primary mb-2"
                    >
                        Live Clipboard
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-text-secondary font-medium"
                    >
                        Real-time collaboration, simplified.
                    </motion.p>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 p-1.5 bg-bg-secondary border border-border-color rounded-2xl mb-8 relative">
                    <button
                        onClick={() => setMode('create')}
                        className={`relative z-10 py-2.5 text-sm font-semibold transition-colors duration-300 rounded-xl flex items-center justify-center gap-2 ${mode === 'create' ? 'text-bg-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create</span>
                        {mode === 'create' && (
                            <motion.div
                                layoutId="tab-bg"
                                className="absolute inset-0 bg-text-primary rounded-xl -z-10 shadow-md"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                    <button
                        onClick={() => setMode('join')}
                        className={`relative z-10 py-2.5 text-sm font-semibold transition-colors duration-300 rounded-xl flex items-center justify-center gap-2 ${mode === 'join' ? 'text-bg-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        <LinkIcon className="w-4 h-4" />
                        <span>Join</span>
                        {mode === 'join' && (
                            <motion.div
                                layoutId="tab-bg"
                                className="absolute inset-0 bg-text-primary rounded-xl -z-10 shadow-md"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-6">
                    <div className="relative group">
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 ml-1">
                            {mode === 'create' ? 'Project Identifier' : 'Destination ID'}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={roomId}
                                onChange={handleIdChange}
                                placeholder="Enter ID..."
                                className="w-full bg-bg-secondary border border-border-color rounded-xl px-4 py-4 text-lg font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/20 focus:border-text-primary transition-all shadow-sm placeholder-text-secondary/30"
                            />

                            {/* Status Indicator */}
                            {mode === 'create' && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                    <AnimatePresence mode="popLayout">
                                        {isChecking ? (
                                            <motion.div
                                                key="checking"
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                            >
                                                <Loader2 className="w-5 h-5 text-text-secondary animate-spin" />
                                            </motion.div>
                                        ) : roomId && isAvailable ? (
                                            <motion.div
                                                key="available"
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                className="flex items-center gap-1.5"
                                            >
                                                <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full dark:bg-green-900/30 dark:text-green-400">AVAILABLE</span>
                                                <div className="bg-green-500 rounded-full p-1">
                                                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                </div>
                                            </motion.div>
                                        ) : roomId && !isAvailable ? (
                                            <motion.div
                                                key="taken"
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                className="flex items-center gap-1.5"
                                            >
                                                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full dark:bg-red-900/30 dark:text-red-400">TAKEN</span>
                                            </motion.div>
                                        ) : null}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAction}
                        disabled={mode === 'create' && !isAvailable}
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest transition-all duration-300 shadow-lg
                            ${mode === 'create' && !isAvailable
                                ? 'opacity-50 cursor-not-allowed bg-border-color text-text-secondary'
                                : 'bg-text-primary text-bg-primary hover:shadow-xl'}`}
                    >
                        <span>{mode === 'create' ? 'Initialize Workspace' : 'Join Workspace'}</span>
                        <ArrowRight className="w-5 h-5" />
                    </motion.button>
                </div>
            </motion.div>

            {/* Footer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 flex flex-col items-center gap-3 text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]"
            >
                <div className="flex items-center gap-3 opacity-60">
                    <span>Secure</span>
                    <div className="w-1 h-1 rounded-full bg-current" />
                    <span>Real-time</span>
                    <div className="w-1 h-1 rounded-full bg-current" />
                    <span>Minimal</span>
                </div>
            </motion.div>
        </div>
    );
};

export default LandingPage;
