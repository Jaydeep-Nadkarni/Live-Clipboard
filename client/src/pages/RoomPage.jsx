import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus, Share2, FileText, Settings,
    MoreHorizontal, FolderOpen, Copy,
    MessageSquare, Hash, User, X, Menu,
    Coffee, HelpCircle, Sun, Users, Terminal,
    File, Code, Image, Music, Database, Layout,
    Check, Palette, Edit3, Trash2
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
    '#888888', '#ffffff', '#ff4444', '#ffbb33', '#00C851', '#33b5e5', '#aa66cc', '#2E2E2E'
];

const RoomPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [roomData, setRoomData] = useState(null);
    const [activeEditorId, setActiveEditorId] = useState(null);
    const [openedFiles, setOpenedFiles] = useState([]); // List of editorIds
    const [copyFeedback, setCopyFeedback] = useState('');
    const [userName, setUserName] = useState(`Guest${Math.floor(Math.random() * 1000)}`);
    const [isRenamingUser, setIsRenamingUser] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // UI State
    const [viewedEditors, setViewedEditors] = useState(new Set());
    const [showCommentsPanel, setShowCommentsPanel] = useState(false);
    const [renamingFileId, setRenamingFileId] = useState(null);
    const [tempFileName, setTempFileName] = useState('');

    // Modal States
    const [isIconModalOpen, setIsIconModalOpen] = useState(false);
    const [editingIconEditorId, setEditingIconEditorId] = useState(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    useEffect(() => {
        fetchRoomData();
        socket.emit('join-room', roomId);

        socket.on('room-remote-data-refetch', () => fetchRoomData(false));
        socket.on('new-comment', (comment) => {
            setRoomData(prev => ({
                ...prev,
                comments: [...(prev.comments || []), comment]
            }));
        });

        return () => {
            socket.off('room-remote-data-refetch');
            socket.off('new-comment');
            socket.off('join-room');
        };
    }, [roomId]);

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

    const copyAllFiles = () => {
        if (!roomData) return;
        const allText = roomData.editors.map(ed => `FILE: ${ed.name}\n${JSON.stringify(ed.content)}\n`).join('\n');
        navigator.clipboard.writeText(allText);
        setCopyFeedback('All Copied!');
        setTimeout(() => setCopyFeedback(''), 2000);
    };

    if (!roomData) return <div className="h-screen bg-black flex items-center justify-center text-[#222] font-mono uppercase tracking-[0.5em]">Initializing Workspace</div>;

    const activeEditor = roomData.editors.find(e => e.editorId === activeEditorId);

    return (
        <div className="flex h-screen bg-black text-[#cccccc] font-sans text-sm overflow-hidden flex-col md:flex-row relative">

            {/* Mobile Header */}
            <div className="md:hidden h-12 bg-black border-b border-[#111] flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-2 font-bold text-[#888] uppercase tracking-widest text-[10px]">
                    <Terminal className="w-3 h-3" /> {roomId}
                </div>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 text-[#888]">
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`
                w-64 border-r border-[#111] bg-black flex flex-col shrink-0 select-none
                fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Brand & Stats */}
                <div className="p-4 border-b border-[#111]">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#444]">Workspace Explorer</span>
                        <div className="flex gap-1">
                            <Plus onClick={createEditor} className="w-3.5 h-3.5 cursor-pointer text-[#444] hover:text-white transition-colors" />
                            <MoreHorizontal className="w-3.5 h-3.5 cursor-pointer text-[#444] hover:text-white" />
                        </div>
                    </div>
                    <button
                        onClick={shareLink}
                        className="w-full bg-[#111] hover:bg-[#1a1a1a] text-[#888] hover:text-white border border-[#222] text-[10px] font-bold py-2 rounded-md flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-widest"
                    >
                        <Share2 className="w-3 h-3" />
                        {copyFeedback === 'Link Copied!' ? 'Link Copied' : 'Share Broadcast'}
                    </button>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto py-4">
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
                                className={`flex items-center px-4 py-2 cursor-pointer text-[13px] group relative ${isActive ? 'bg-[#0a0a0a] text-white shadow-[inset_2px_0_0_#fff]' : 'text-[#555] hover:text-[#aaa]'
                                    }`}
                            >
                                <div
                                    className="p-1 px-1.5 rounded mr-2 transition-colors hover:bg-white/5"
                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingIconEditorId(editor.editorId); setIsIconModalOpen(true); }}
                                    title="Double-click to change icon"
                                >
                                    <IconComponent className="w-3.5 h-3.5" style={{ color: editor.iconColor || '#888' }} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    {isRenaming ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={tempFileName}
                                            onChange={(e) => setTempFileName(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-[#111] text-white outline-none w-full border border-[#333] text-xs px-1"
                                        />
                                    ) : (
                                        <span className="truncate block">{editor.name}</span>
                                    )}
                                </div>

                                {!isViewed && <div className="w-1.5 h-1.5 rounded-full bg-white ml-2 animate-pulse" title="Unread" />}
                            </div>
                        );
                    })}
                </div>

                {/* Sidebar Footer */}
                <div className="mt-auto border-t border-[#111]">
                    <button
                        onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                        className={`w-full flex items-center gap-3 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${showCommentsPanel ? 'text-white bg-[#0a0a0a]' : 'text-[#444] hover:text-[#888]'}`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Comments Panel
                        {roomData.comments?.length > 0 && <span className="ml-auto bg-[#333] text-white px-1.5 py-0.5 rounded-full text-[9px]">{roomData.comments.length}</span>}
                    </button>

                    <div className="p-3 px-6 flex items-center justify-between">
                        <div className="flex items-center gap-2 max-w-[80%] group">
                            <User className="w-3 h-3 text-[#444]" />
                            {isRenamingUser ? (
                                <input
                                    autoFocus
                                    className="bg-transparent outline-none text-white w-full border-b border-[#333] text-[11px]"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    onBlur={() => setIsRenamingUser(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsRenamingUser(false)}
                                />
                            ) : (
                                <span onDoubleClick={() => setIsRenamingUser(true)} className="text-[11px] font-bold text-[#444] hover:text-[#888] cursor-text transition-colors">
                                    {userName}
                                </span>
                            )}
                        </div>
                        <button onClick={copyAllFiles} title="Copy All Files"><Copy className="w-3 h-3 text-[#444] hover:text-white" /></button>
                    </div>
                    <div className="px-6 pb-4 text-[9px] font-bold text-[#222] uppercase tracking-[0.2em]">
                        Made with love by Jaydeep
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-black relative">

                {/* Top Interaction Tabs */}
                <div className="h-10 bg-[#050505] flex items-center overflow-x-auto scrollbar-hide border-b border-[#111]">
                    {openedFiles.map(fid => {
                        const file = roomData.editors.find(e => e.editorId === fid);
                        if (!file) return null;
                        const isActive = activeEditorId === fid;
                        const IconComp = ICON_MAP[file.icon || 'FileText'];
                        return (
                            <div
                                key={fid}
                                onClick={() => setActiveEditorId(fid)}
                                className={`flex items-center h-full px-4 border-r border-[#111] cursor-default min-w-[140px] max-w-[200px] transition-all relative ${isActive ? 'bg-black text-white' : 'hover:bg-[#0a0a0a] text-[#444]'}`}
                            >
                                {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-white" />}
                                <IconComp className="w-3 h-3 mr-2" style={{ color: file.iconColor }} />
                                <span className="truncate flex-1 text-[11px] font-bold uppercase tracking-wider">{file.name}</span>
                                <button onClick={(e) => handleFileClose(e, fid)} className="p-1 hover:bg-[#111] rounded ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="w-3 h-3 text-[#444]" />
                                </button>
                                {isActive && <X onClick={(e) => handleFileClose(e, fid)} className="w-3 h-3 ml-2 text-[#444] hover:text-white cursor-pointer" />}
                            </div>
                        );
                    })}
                    {showCommentsPanel && (
                        <div
                            onClick={() => setActiveEditorId('comments')}
                            className={`flex items-center h-full px-4 border-r border-[#111] cursor-default transition-all relative ${activeEditorId === 'comments' ? 'bg-black text-white' : 'hover:bg-[#0a0a0a] text-[#444]'}`}
                        >
                            {activeEditorId === 'comments' && <div className="absolute top-0 left-0 right-0 h-[2px] bg-white" />}
                            <MessageSquare className="w-3 h-3 mr-2" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Comments Log</span>
                        </div>
                    )}
                </div>

                {/* Workspace Content */}
                <div className="flex-1 flex flex-col relative overflow-hidden">

                    {/* Info Header Area */}
                    <div className="p-3 md:p-4 px-4 md:px-8 border-b border-[#111] flex flex-wrap items-center justify-between text-[#444] shrink-0 bg-[#050505]/50 backdrop-blur-3xl gap-4">
                        <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
                            <div className="flex flex-col min-w-fit">
                                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-[#222]">Project ID</span>
                                <span className="text-[10px] md:text-xs font-bold text-[#888]">{roomId}</span>
                            </div>
                            <div className="h-6 w-[1px] bg-[#111] shrink-0" />
                            <div className="flex flex-col min-w-fit">
                                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-[#222]">Collaborators</span>
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-3 h-3" />
                                    <span className="text-[10px] md:text-xs font-bold text-[#888]">1+ Active</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 md:gap-4 ml-auto">
                            <button onClick={() => setIsHelpOpen(true)} className="hidden sm:flex items-center gap-2 text-[9px] md:text-[10px] font-bold hover:text-white transition-colors uppercase tracking-widest whitespace-nowrap">
                                <HelpCircle className="w-3.5 h-3.5" /> Help
                            </button>
                            <button className="hidden sm:flex items-center gap-2 text-[9px] md:text-[10px] font-bold hover:text-white transition-colors uppercase tracking-widest whitespace-nowrap">
                                <Sun className="w-3.5 h-3.5" /> Theme
                            </button>
                            <div className="hidden sm:block h-4 w-[1px] bg-[#111] shrink-0" />
                            <a href="#" className="flex items-center gap-2 bg-white text-black px-3 py-1.5 rounded-full text-[8px] md:text-[9px] font-black hover:bg-[#ccc] transition-all uppercase tracking-tighter whitespace-nowrap">
                                <Coffee className="w-3 h-3 fill-current" /> Buy Coffee
                            </a>
                        </div>
                    </div>

                    {/* Editor / Comments Log Split */}
                    <div className="flex-1 flex overflow-hidden">
                        {activeEditorId === 'comments' || (showCommentsPanel && activeEditorId === null) ? (
                            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-black">
                                <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-8">Activity Feed</h2>
                                <div className="space-y-6 max-w-2xl">
                                    {(roomData.comments || []).length === 0 ? (
                                        <div className="text-[#333] text-sm uppercase italic tracking-widest">No discussions initiated yet...</div>
                                    ) : (
                                        roomData.comments.map(c => (
                                            <div key={c.commentId} className="border-l border-[#222] pl-6 py-2 group">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-6 h-6 bg-[#111] rounded-full flex items-center justify-center text-[8px] font-bold text-[#555] border border-[#222]">{c.author[0]}</div>
                                                    <span className="text-[10px] font-black text-[#555] uppercase tracking-widest">{c.author}</span>
                                                    <span className="text-[8px] font-bold text-[#222] uppercase">{new Date(c.createdAt).toLocaleTimeString()}</span>
                                                </div>
                                                <p className="text-sm text-[#888] mb-2">{c.text}</p>
                                                <div className="flex items-center gap-2 text-[9px] font-black text-[#333] uppercase">
                                                    <div className="flex items-center gap-1 hover:text-white cursor-pointer" onClick={() => handleFileOpen(c.editorId)}>
                                                        <LinkIcon className="w-2.5 h-2.5" /> Jump to File
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
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
                                onAddComment={(c) => {
                                    setRoomData(prev => ({
                                        ...prev,
                                        comments: [...(prev.comments || []), c]
                                    }));
                                }}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-[#222] gap-4">
                                <Terminal className="w-12 h-12 opacity-50" />
                                <span className="text-xs font-black uppercase tracking-[0.3em]">Select a kernel to begin operation</span>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modals */}
            <Modal isOpen={isIconModalOpen} onClose={() => setIsIconModalOpen(false)} title="Customize Environment">
                <div className="space-y-8">
                    <section>
                        <h4 className="text-[10px] font-black text-[#444] uppercase tracking-widest mb-4">Select Prototype</h4>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.keys(ICON_MAP).map(iconName => {
                                const IconComp = ICON_MAP[iconName];
                                return (
                                    <button
                                        key={iconName}
                                        onClick={() => updateEditorStyle(editingIconEditorId, iconName, roomData.editors.find(e => e.editorId === editingIconEditorId).iconColor)}
                                        className="p-4 bg-black border border-[#222] hover:border-white rounded-xl flex items-center justify-center transition-all group"
                                    >
                                        <IconComp className="w-5 h-5 text-[#444] group-hover:text-white" />
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                    <section>
                        <h4 className="text-[10px] font-black text-[#444] uppercase tracking-widest mb-4">Spectrum Override</h4>
                        <div className="flex gap-3 flex-wrap justify-center">
                            {COLOR_PALETTE.map(color => (
                                <button
                                    key={color}
                                    onClick={() => updateEditorStyle(editingIconEditorId, roomData.editors.find(e => e.editorId === editingIconEditorId).icon, color)}
                                    className="w-10 h-10 rounded-full border border-[#222] hover:scale-110 transition-transform flex items-center justify-center"
                                    style={{ backgroundColor: color }}
                                >
                                    {roomData.editors.find(e => e.editorId === editingIconEditorId)?.iconColor === color && <Check className="w-4 h-4 text-black mix-blend-difference" />}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            </Modal>

            <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Operation Manual">
                <div className="space-y-4 text-xs font-bold text-[#666] uppercase tracking-widest leading-relaxed">
                    <p><span className="text-white">File Control:</span> Double-click filenames to rename. Double-click icons to customize archetype.</p>
                    <p><span className="text-white">Collaboration:</span> Select text to initiate the tactical bubble menu for highlights and deep-linking comments.</p>
                    <p><span className="text-white">Workspace:</span> Shared state persists for 24 hours per node activation.</p>
                </div>
            </Modal>
        </div>
    );
};

export default RoomPage;
