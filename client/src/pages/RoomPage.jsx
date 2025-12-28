import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus, Share2, FileText, Settings,
    MoreHorizontal, FolderOpen, Copy,
    MessageSquare, Hash, User, X, Menu,
    Coffee, HelpCircle, Sun, Users, Terminal,
    File, Code, Image, Music, Database, Layout,
    Check, Palette, Edit3, Trash2, Moon, Monitor,
    Link as LinkIcon, Reply, Send, MoreVertical,
    FileMinus, Search, Share
} from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import Editor from '../components/Editor';
import Modal from '../components/Modal';

const API_BASE = import.meta.env.VITE_API_URL;
const socket = io(import.meta.env.VITE_SOCKET_URL);

const ICON_MAP = {
    FileText, File, Code, Terminal, Database, Layout, Image, Music
};

const COLOR_PALETTE = [
    '#ffffff', '#888888', '#ff4444', '#ffbb33', '#00C851', '#33b5e5', '#aa66cc'
];

const USER_COLORS = [
    '#ff4444', '#33b5e5', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'
];

const RoomPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [roomData, setRoomData] = useState(null);
    const [activeEditorId, setActiveEditorId] = useState(null);
    const [openedFiles, setOpenedFiles] = useState([]);
    const [copyFeedback, setCopyFeedback] = useState('');
    const [userName, setUserName] = useState(`Guest${Math.floor(Math.random() * 1000)}`);
    const [isRenamingUser, setIsRenamingUser] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState('dark');

    // Presence & UI
    const [collaborators, setCollaborators] = useState([]);
    const [showCollabList, setShowCollabList] = useState(false);
    const [viewedEditors, setViewedEditors] = useState(new Set());
    const [showCommentsPanel, setShowCommentsPanel] = useState(false);
    const [renamingFileId, setRenamingFileId] = useState(null);
    const [tempFileName, setTempFileName] = useState('');
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);

    // Discussion UI
    const [directComment, setDirectComment] = useState('');
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState('');

    // Modal States
    const [isIconModalOpen, setIsIconModalOpen] = useState(false);
    const [editingIconEditorId, setEditingIconEditorId] = useState(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    useEffect(() => {
        document.body.setAttribute('data-theme', currentTheme);
    }, [currentTheme]);

    useEffect(() => {
        fetchRoomData();
        socket.emit('join-room', roomId, { name: userName });

        socket.on('room-remote-data-refetch', () => fetchRoomData(false));
        socket.on('collaborators-update', (list) => {
            setCollaborators(list);
        });

        return () => {
            socket.off('room-remote-data-refetch');
            socket.off('collaborators-update');
            socket.off('join-room');
        };
    }, [roomId, userName]);

    const fetchRoomData = async (shouldSetActive = true) => {
        try {
            const resp = await axios.get(`${API_BASE}/rooms/check/${roomId}`);
            if (!resp.data.exists) { navigate('/'); return; }
            const fullData = await axios.get(`${API_BASE}/rooms/data/${roomId}`);
            setRoomData(fullData.data);

            if (shouldSetActive && fullData.data.editors.length > 0 && !activeEditorId) {
                const firstId = fullData.data.editors[0].editorId;
                handleFileOpen(firstId);
            }
        } catch (err) {
            console.error('Error fetching room:', err);
        }
    };

    const handleFileOpen = (id) => {
        setActiveEditorId(id);
        if (!openedFiles.includes(id)) {
            setOpenedFiles(prev => [...prev, id]);
        }
        setViewedEditors(prev => new Set([...prev, id]));
        setMobileMenuOpen(false);
    };

    const handleFileClose = (e, id) => {
        e.stopPropagation();
        const newOpened = openedFiles.filter(fid => fid !== id);
        setOpenedFiles(newOpened);
        if (activeEditorId === id) {
            setActiveEditorId(newOpened.length > 0 ? newOpened[newOpened.length - 1] : null);
        }
    };

    const closeAllTabs = () => {
        setOpenedFiles([]);
        setActiveEditorId(null);
        setMoreMenuOpen(false);
    };

    const deleteFile = (e, editorId) => {
        e.stopPropagation();
        if (window.confirm('Delete this file permanently?')) {
            socket.emit('delete-editor', { roomId, editorId });
            setRoomData(prev => ({
                ...prev,
                editors: prev.editors.filter(e => e.editorId !== editorId)
            }));
            const newOpened = openedFiles.filter(id => id !== editorId);
            setOpenedFiles(newOpened);
            if (activeEditorId === editorId) {
                setActiveEditorId(newOpened.length > 0 ? newOpened[newOpened.length - 1] : null);
            }
        }
    };

    const createEditor = async () => {
        const untitledCount = roomData.editors.filter(e => e.name.startsWith('Untitled')).length;
        const name = untitledCount === 0 ? 'Untitled' : `Untitled ${untitledCount}`;
        try {
            const resp = await axios.post(`${API_BASE}/rooms/add-editor/${roomId}`, { name });
            setRoomData(resp.data);
            const newId = resp.data.editors[resp.data.editors.length - 1].editorId;
            handleFileOpen(newId);
            socket.emit('room-structure-update', { roomId });
        } catch (err) {
            alert('Error creating file');
        }
    };

    const handlePostDirectComment = () => {
        if (!directComment.trim()) return;
        const newComment = {
            commentId: Math.random().toString(36).substring(2, 9),
            editorId: activeEditorId || 'global',
            text: directComment,
            author: userName,
            createdAt: new Date().toISOString()
        };
        socket.emit('add-comment', { roomId, comment: newComment });
        setRoomData(prev => ({
            ...prev,
            comments: [...(prev.comments || []), newComment]
        }));
        setDirectComment('');
    };

    const handleDeleteComment = (commentId) => {
        if (window.confirm('Delete this message?')) {
            socket.emit('delete-comment', { roomId, commentId });
            setRoomData(prev => ({
                ...prev,
                comments: prev.comments.filter(c => c.commentId !== commentId)
            }));
        }
    };

    const submitCommentEdit = (commentId) => {
        socket.emit('edit-comment', { roomId, commentId, newText: editingCommentText });
        setRoomData(prev => ({
            ...prev,
            comments: prev.comments.map(c => c.commentId === commentId ? { ...c, text: editingCommentText } : c)
        }));
        setEditingCommentId(null);
    };

    const updateEditorStyle = (editorId, icon, color) => {
        socket.emit('update-editor-style', { roomId, editorId, icon, iconColor: color });
        setRoomData(prev => ({
            ...prev,
            editors: prev.editors.map(ed => ed.editorId === editorId ? { ...ed, icon, iconColor: color } : ed)
        }));
        setIsIconModalOpen(false);
    };

    const submitRename = async () => {
        if (!tempFileName.trim()) { setRenamingFileId(null); return; }
        socket.emit('rename-editor', { roomId, editorId: renamingFileId, newName: tempFileName });
        setRoomData(prev => ({
            ...prev,
            editors: prev.editors.map(ed => ed.editorId === renamingFileId ? { ...ed, name: tempFileName } : ed)
        }));
        setRenamingFileId(null);
    };

    const shareLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopyFeedback('Link Copied!');
        setTimeout(() => setCopyFeedback(''), 2000);
    };

    if (!roomData) return <div className="h-screen bg-black flex items-center justify-center text-[#222] font-mono uppercase tracking-[0.5em]">Initializing Workspace</div>;

    const activeEditor = roomData.editors.find(e => e.editorId === activeEditorId);
    const getUserColor = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
    };

    return (
        <div className="flex h-screen bg-bg-primary text-text-primary font-sans text-sm overflow-hidden flex-col md:flex-row relative transition-colors duration-300">

            {/* Mobile Header */}
            <div className="md:hidden h-12 bg-bg-secondary border-b border-border-color flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-2 font-bold text-text-secondary uppercase tracking-widest text-[10px]">
                    <Terminal className="w-3 h-3" /> {roomId}
                </div>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 text-text-secondary">
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`
                w-64 border-r border-border-color bg-bg-secondary flex flex-col shrink-0 select-none
                fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Brand & Explorer */}
                <div className="p-4 border-b border-border-color">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">Explorer</span>
                        <div className="flex gap-1">
                            <Plus onClick={createEditor} className="w-3.5 h-3.5 cursor-pointer text-text-secondary hover:text-text-primary transition-colors" />
                            <MoreHorizontal className="w-3.5 h-3.5 cursor-pointer text-text-secondary hover:text-text-primary" />
                        </div>
                    </div>
                    <button
                        onClick={shareLink}
                        className="w-full bg-bg-primary hover:opacity-80 text-text-secondary hover:text-text-primary border border-border-color text-[10px] font-bold py-2 rounded-md flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-widest"
                    >
                        <Share2 className="w-3 h-3" />
                        {copyFeedback === 'Link Copied!' ? 'Link Copied' : 'Share Broadcast'}
                    </button>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto py-2">
                    {roomData.editors.map(editor => {
                        const isActive = activeEditorId === editor.editorId;
                        const isViewed = viewedEditors.has(editor.editorId);
                        const isRenaming = renamingFileId === editor.editorId;
                        const IconComponent = ICON_MAP[editor.icon || 'FileText'];

                        return (
                            <div
                                key={editor.editorId}
                                onClick={() => handleFileOpen(editor.editorId)}
                                onDoubleClick={(e) => { e.stopPropagation(); setRenamingFileId(editor.editorId); setTempFileName(editor.name); }}
                                className={`flex items-center px-4 py-2 cursor-pointer text-[13px] group relative ${isActive ? 'bg-bg-primary shadow-[inset_2px_0_0_currentColor]' : 'hover:bg-bg-primary/50 text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                <div
                                    className="p-1 px-1.5 rounded transition-colors hover:bg-white/5"
                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingIconEditorId(editor.editorId); setIsIconModalOpen(true); }}
                                >
                                    <IconComponent className="w-3.5 h-3.5" style={{ color: editor.iconColor || 'inherit' }} />
                                </div>

                                <div className="flex-1 min-w-0 ml-2">
                                    {isRenaming ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={tempFileName}
                                            onChange={(e) => setTempFileName(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-bg-secondary text-text-primary outline-none w-full border border-border-color text-xs px-1"
                                        />
                                    ) : (
                                        <span className="truncate block font-medium">{editor.name}</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 onClick={(e) => deleteFile(e, editor.editorId)} className="w-3 h-3 text-rose-500 hover:scale-125 transition-transform" />
                                </div>

                                {!isViewed && <div className="w-1.5 h-1.5 rounded-full bg-accent-color ml-2 animate-pulse" title="Unread" style={{ backgroundColor: 'var(--accent-color)' }} />}
                            </div>
                        );
                    })}
                </div>

                {/* Sidebar Footer */}
                <div className="mt-auto border-t border-border-color">
                    <button
                        onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                        className={`w-full flex items-center gap-3 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${showCommentsPanel ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Discussions
                        {roomData.comments?.length > 0 && <span className="ml-auto bg-text-secondary text-bg-primary px-1.5 py-0.5 rounded-full text-[9px] font-black">{roomData.comments.length}</span>}
                    </button>

                    <div className="p-3 px-6 flex items-center justify-between">
                        <div className="flex items-center gap-2 max-w-[80%] group">
                            <User className="w-3 h-3 text-text-secondary" />
                            {isRenamingUser ? (
                                <input
                                    autoFocus
                                    className="bg-transparent outline-none text-text-primary w-full border-b border-border-color text-[11px]"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    onBlur={() => setIsRenamingUser(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsRenamingUser(false)}
                                />
                            ) : (
                                <span onDoubleClick={() => setIsRenamingUser(true)} className="text-[11px] font-bold text-text-secondary hover:text-text-primary cursor-text transition-colors">
                                    {userName}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="px-6 pb-4 text-[9px] font-bold opacity-30 uppercase tracking-[0.2em]">
                        Made with love by Jaydeep
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 flex flex-col min-w-0 relative">

                {/* HEADER INFO */}
                <div className="p-4 px-8 border-b border-border-color bg-bg-secondary/50 backdrop-blur-md flex items-center justify-between shrink-0 gap-6">
                    <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-widest opacity-20">Project NODE</span>
                            <span className="text-xs font-bold font-mono">{roomId}</span>
                        </div>
                        <div className="h-6 w-[1px] bg-border-color" />
                        <div className="relative group/collab">
                            <div className="flex flex-col cursor-pointer" onClick={() => setShowCollabList(!showCollabList)}>
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-20">Lobby</span>
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-3 h-3" />
                                    <span className="text-xs font-bold">{collaborators.length || 1} Active</span>
                                </div>
                            </div>

                            {/* Fixed Collaborators List UI */}
                            {(showCollabList || true) && collaborators.length > 0 && (
                                <div className="absolute top-12 left-0 z-[60] bg-bg-secondary border border-border-color p-2 rounded-lg shadow-2xl min-w-[140px] opacity-0 group-hover/collab:opacity-100 pointer-events-none group-hover/collab:pointer-events-auto transition-opacity duration-200">
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-2 p-1">Connected Entities</p>
                                    <div className="space-y-1">
                                        {collaborators.map((c, i) => (
                                            <div key={i} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5">
                                                <div className="w-4 h-4 rounded-md flex items-center justify-center text-[7px] text-bg-primary font-black uppercase" style={{ backgroundColor: getUserColor(c.name) }}>{c.name?.[0]}</div>
                                                <span className="text-[10px] font-bold text-text-primary truncate">{c.name} {c.name === userName && '(You)'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                        <button onClick={() => setCurrentTheme(currentTheme === 'dark' ? 'light' : 'dark')} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            {currentTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setIsHelpOpen(true)} className="hidden sm:flex items-center gap-2 text-[10px] font-bold hover:text-text-primary transition-colors opacity-50 uppercase tracking-widest">
                            <HelpCircle className="w-3.5 h-3.5" /> Manual
                        </button>
                        <div className="hidden sm:block h-4 w-[1px] bg-border-color" />
                        <a href="https://buy-me-a-coffee.com" target="_blank" className="flex items-center gap-2 bg-text-primary text-bg-primary px-3 py-1.5 rounded-full text-[9px] font-black hover:opacity-80 transition-all uppercase">
                            <Coffee className="w-3 h-3 fill-current" /> Coffee
                        </a>
                    </div>
                </div>

                {/* TABS (Relative Chrome Sizing) */}
                <div className="h-10 bg-bg-secondary flex items-center border-b border-border-color relative">
                    <div className="flex-1 flex items-center overflow-x-auto no-scrollbar h-full pr-10">
                        {openedFiles.map(fid => {
                            const file = roomData.editors.find(e => e.editorId === fid);
                            if (!file) return null;
                            const isActive = activeEditorId === fid;
                            const IconComp = ICON_MAP[file.icon || 'FileText'];
                            return (
                                <div
                                    key={fid}
                                    onClick={() => handleFileOpen(fid)}
                                    className={`
                                        flex items-center h-full px-4 border-r border-border-color cursor-pointer transition-all relative flex-shrink flex-grow min-w-[80px] max-w-[180px] group/tab
                                        ${isActive ? 'bg-bg-primary text-text-primary shadow-[inset_0_2px_0_var(--accent-color)] active-tab' : 'hover:bg-bg-primary/50 text-text-secondary'}
                                    `}
                                >
                                    <IconComp className="w-3 h-3 mr-2 shrink-0" style={{ color: file.iconColor }} />
                                    <span className="truncate flex-1 text-[11px] font-bold tracking-tight uppercase">{file.name}</span>
                                    <X
                                        onClick={(e) => handleFileClose(e, fid)}
                                        className="w-3 h-3 ml-2 opacity-0 group-hover/tab:opacity-100 hover:bg-white/10 rounded p-0.5 cursor-pointer"
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* 3 Dots Menu */}
                    <div className="absolute right-2 flex items-center gap-1 bg-bg-secondary pl-2">
                        <button
                            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                            className="p-1 hover:bg-white/5 rounded"
                        >
                            <MoreVertical className="w-4 h-4 text-text-secondary" />
                        </button>

                        {moreMenuOpen && (
                            <div className="absolute top-10 right-0 z-50 bg-bg-secondary border border-border-color shadow-2xl rounded-lg p-2 min-w-[160px]">
                                <button onClick={closeAllTabs} className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 text-rose-500 rounded flex items-center gap-2">
                                    <FileMinus className="w-3 h-3" /> Close All Tabs
                                </button>
                                <button onClick={() => setMoreMenuOpen(false)} className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 rounded flex items-center gap-2">
                                    <Settings className="w-3 h-3" /> Editor Settings
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 flex overflow-hidden">
                    {activeEditorId === 'comments' || (showCommentsPanel && activeEditorId === null) ? (
                        <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
                                <h2 className="text-xl font-black text-text-primary uppercase tracking-[0.2em] mb-12 flex items-center gap-4">
                                    Discussions
                                    <div className="h-1 flex-1 bg-border-color" />
                                </h2>

                                <div className="space-y-10 max-w-3xl border-l-2 border-border-color ml-4">
                                    {(roomData.comments || []).length === 0 ? (
                                        <div className="pl-8 text-text-secondary/20 font-black italic uppercase text-2xl tracking-tighter">Void...</div>
                                    ) : (
                                        roomData.comments.map(c => (
                                            <div key={c.commentId} className="relative group pr-4">
                                                {/* Left Decorative Line / Avatar */}
                                                <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-md border-2 border-bg-primary shadow-sm flex items-center justify-center text-[8px] font-black text-bg-primary" style={{ backgroundColor: getUserColor(c.author) }}>
                                                    {c.author[0]}
                                                </div>

                                                <div className="pl-8">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: getUserColor(c.author) }}>{c.author}</span>
                                                        <span className="text-[8px] font-bold opacity-30 uppercase">{new Date(c.createdAt).toLocaleTimeString()}</span>

                                                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                                                            {c.author === userName && (
                                                                <>
                                                                    <button onClick={() => { setEditingCommentId(c.commentId); setEditingCommentText(c.text) }} className="text-[8px] font-black text-text-secondary hover:text-text-primary uppercase">Edit</button>
                                                                    <button onClick={() => handleDeleteComment(c.commentId)} className="text-[8px] font-black text-rose-500/50 hover:text-rose-500 uppercase">Delete</button>
                                                                </>
                                                            )}
                                                            <button onClick={() => handleFileOpen(c.editorId)} className="text-[8px] font-black text-text-secondary hover:text-text-primary uppercase">Jump</button>
                                                        </div>
                                                    </div>

                                                    {editingCommentId === c.commentId ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                autoFocus
                                                                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none"
                                                                value={editingCommentText}
                                                                onChange={(e) => setEditingCommentText(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && submitCommentEdit(c.commentId)}
                                                            />
                                                            <Check onClick={() => submitCommentEdit(c.commentId)} className="w-4 h-4 text-green-500 cursor-pointer" />
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-text-primary/70 leading-relaxed max-w-xl">{c.text}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* NEW DIRECT COMMENT BAR */}
                            <div className="p-6 bg-bg-secondary border-t border-border-color">
                                <div className="max-w-3xl mx-auto flex gap-4">
                                    <input
                                        type="text"
                                        value={directComment}
                                        onChange={(e) => setDirectComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handlePostDirectComment()}
                                        placeholder={`Broadcast as ${userName}...`}
                                        className="flex-1 bg-bg-primary border border-border-color rounded-xl px-6 py-3 text-sm focus:outline-none focus:border-text-primary transition-all"
                                    />
                                    <button
                                        onClick={handlePostDirectComment}
                                        className="bg-text-primary text-bg-primary p-3 rounded-xl hover:opacity-80 transition-opacity"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : activeEditor ? (
                        <Editor
                            key={activeEditorId}
                            content={activeEditor?.content}
                            socket={socket}
                            roomId={roomId}
                            editorId={activeEditorId}
                            userName={userName}
                            onUpdate={(json) => {
                                setRoomData(prev => ({
                                    ...prev,
                                    editors: prev.editors.map(ed => ed.editorId === activeEditorId ? { ...ed, content: json } : ed)
                                }));
                            }}
                            onAddComment={(c) => {
                                setRoomData(prev => ({
                                    ...prev,
                                    comments: [...(prev.comments || []), c]
                                }));
                            }}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-12 text-center">
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <Terminal className="w-10 h-10 opacity-20" />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-[0.4em] opacity-40">Workspace Ready</h3>
                            <p className="max-w-xs text-text-secondary text-xs uppercase font-bold tracking-widest leading-loose">Initialize a kernel module from the explorer to begin collaborative processing.</p>
                            <button onClick={createEditor} className="mt-4 px-8 py-3 bg-text-primary text-bg-primary rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform">Create New Module</button>
                        </div>
                    )}
                </div>
            </main>

            {/* MODALS */}
            <Modal isOpen={isIconModalOpen} onClose={() => setIsIconModalOpen(false)} title="Archetype Definition">
                <div className="space-y-8">
                    <div className="grid grid-cols-4 gap-3">
                        {Object.keys(ICON_MAP).map(iconName => (
                            <button
                                key={iconName}
                                onClick={() => updateEditorStyle(editingIconEditorId, iconName, roomData.editors.find(e => e.editorId === editingIconEditorId).iconColor)}
                                className="p-4 bg-bg-primary border border-border-color hover:border-text-primary rounded-2xl flex items-center justify-center transition-all group"
                            >
                                {React.createElement(ICON_MAP[iconName], { className: "w-6 h-6 opacity-40 group-hover:opacity-100" })}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-3 flex-wrap justify-center border-t border-border-color pt-8">
                        {COLOR_PALETTE.map(color => (
                            <button
                                key={color}
                                onClick={() => updateEditorStyle(editingIconEditorId, roomData.editors.find(e => e.editorId === editingIconEditorId).icon, color)}
                                className="w-10 h-10 rounded-full border-4 border-bg-secondary hover:scale-110 transition-transform flex items-center justify-center shadow-lg"
                                style={{ backgroundColor: color }}
                            >
                                {roomData.editors.find(e => e.editorId === editingIconEditorId)?.iconColor === color && <Check className="w-4 h-4 text-black mix-blend-difference" />}
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="System Overview">
                <div className="space-y-6 text-[10px] font-black uppercase tracking-widest leading-relaxed opacity-60">
                    <p><span className="text-text-primary">Direct Input:</span> Use the broadcast bar in discussions to post global workspace updates.</p>
                    <p><span className="text-text-primary">Theme Control:</span> Toggle between High-Contrast Dark and Paper Light modes via the header control.</p>
                    <p><span className="text-text-primary">Module Ops:</span> Double-click icons to define archetypes. Hover to reveal deletion triggers.</p>
                </div>
            </Modal>
        </div>
    );
};

export default RoomPage;
