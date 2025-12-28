import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus, Share2, FileText,
    MoreHorizontal,
    MessageSquare, User, X, Menu,
    Sun, Terminal,
    File, Code, Image, Music, Database, Layout,
    Check, Trash2, Moon,
    Send, MoreVertical,
    FileMinus
} from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import Editor from '../components/Editor';
import Modal from '../components/Modal';
import bmcButton from '../assets/bmc-button.png';

const API_BASE = import.meta.env.VITE_API_URL;
const socket = io(import.meta.env.VITE_SOCKET_URL);

const ICON_MAP = {
    FileText, File, Code, Terminal, Database, Layout, Image, Music
};

const getUserColor = (username, theme) => {
    if (!username) return 'var(--text-primary)';

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    const h = Math.abs(hash % 360);
    // Vibrant saturation
    const s = 80;
    // Lightness: Dark theme needs bright colors (for dark bg/black text), 
    // Light theme needs dark colors (for light bg/white text)
    // Note: The avatar text color is bg-primary (inverse of theme usually), 
    // but code uses text-bg-primary which is the background color.
    // Light Mode: text is #FAFAFA (White). Need Dark BG. -> L = 40%
    // Dark Mode: text is #0F0F0F (Black). Need Light BG. -> L = 75%
    const l = theme === 'dark' ? 75 : 40;

    return `hsl(${h}, ${s}%, ${l}%)`;
};

const RoomPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [roomData, setRoomData] = useState(null);
    const [activeEditorId, setActiveEditorId] = useState(null);
    const [openedFiles, setOpenedFiles] = useState([]);
    const [copyFeedback, setCopyFeedback] = useState('');
    const [userName, setUserName] = useState(() => localStorage.getItem('userName') || `Guest${Math.floor(Math.random() * 1000)}`);
    const [isRenamingUser, setIsRenamingUser] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Theme State
    const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('theme') || 'light');

    useEffect(() => {
        document.documentElement.dataset.theme = currentTheme;
        localStorage.setItem('theme', currentTheme);
    }, [currentTheme]);

    const toggleTheme = () => {
        setCurrentTheme(prev => prev === 'light' ? 'dark' : 'light');
    };
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
    const [typingUsers, setTypingUsers] = useState({}); // { username: boolean }
    const [replyText, setReplyText] = useState('');
    const [replyingToId, setReplyingToId] = useState(null);

    // Modal States
    const [isIconModalOpen, setIsIconModalOpen] = useState(false);
    const [editingIconEditorId, setEditingIconEditorId] = useState(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [mentionNotification, setMentionNotification] = useState(null);

    const renderCommentText = (text) => {
        if (!text) return null;
        const parts = text.split(/(@\w+)/g);
        return parts.map((part, i) => {
            if (part.match(/^@\w+$/)) {
                return (
                    <span key={i} className="mention" style={{ verticalAlign: 'baseline', display: 'inline-block' }}>{part}</span>
                );
            }
            return part;
        });
    };



    useEffect(() => {
        localStorage.setItem('userName', userName);
    }, [userName]);

    useEffect(() => {
        fetchRoomData();
        socket.emit('join-room', roomId, { name: userName });

        socket.on('room-remote-data-refetch', () => fetchRoomData(false));
        socket.on('collaborators-update', (list) => {
            setCollaborators(list);
        });
        socket.on('new-comment', (comment) => {
            setRoomData(prev => {
                if (!prev) return prev;
                // Avoid duplicates if latency is weird
                if (prev.comments?.some(c => c.commentId === comment.commentId)) return prev;
                return {
                    ...prev,
                    comments: [...(prev.comments || []), comment]
                };
            });
        });

        socket.on('editor-remote-update', ({ editorId, content }) => {
            setRoomData(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    editors: prev.editors.map(e => e.editorId === editorId ? { ...e, content } : e)
                };
            });
        });

        socket.on('remote-typing-update', ({ user, isTyping }) => {
            setTypingUsers(prev => ({ ...prev, [user.name]: isTyping }));
            if (isTyping) {
                // Auto-clear after a few seconds in case we miss the stop event
                setTimeout(() => {
                    setTypingUsers(prev => ({ ...prev, [user.name]: false }));
                }, 3000);
            }
        });

        socket.on('mention-notification', ({ author, text }) => {
            setMentionNotification({ author, text });
            // Play a subtle sound if desired, or just show visual
            setTimeout(() => setMentionNotification(null), 5000);
        });

        return () => {
            socket.off('room-remote-data-refetch');
            socket.off('collaborators-update');
            socket.off('new-comment');
            socket.off('editor-remote-update');
            socket.off('remote-typing-update');
            socket.off('mention-notification');
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

    const handlePostReply = (parentId) => {
        if (!replyText.trim()) return;
        const newComment = {
            commentId: Math.random().toString(36).substring(2, 9),
            editorId: activeEditorId || 'global',
            text: replyText,
            author: userName,
            parentId,
            createdAt: new Date().toISOString()
        };
        socket.emit('add-comment', { roomId, comment: newComment });
        setRoomData(prev => ({
            ...prev,
            comments: [...(prev.comments || []), newComment]
        }));
        setReplyText('');
        setReplyingToId(null);
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
        // Strict B&W: Ignore color, just update icon.
        socket.emit('update-editor-style', { roomId, editorId, icon, iconColor: 'var(--text-primary)' });
        setRoomData(prev => ({
            ...prev,
            editors: prev.editors.map(ed => ed.editorId === editorId ? { ...ed, icon, iconColor: 'var(--text-primary)' } : ed)
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

    const handleUserClick = (name) => {
        // Feature: Mention user helper
        navigator.clipboard.writeText(`@${name}`);
        alert(`Copied @${name} to clipboard!`);
    };

    if (!roomData) return <div className="h-screen bg-bg-primary flex items-center justify-center text-text-primary font-mono uppercase tracking-[0.5em]">Initializing Workspace</div>;

    const activeEditor = roomData.editors.find(e => e.editorId === activeEditorId);

    return (
        <div className="flex h-screen bg-bg-primary text-text-primary font-sans text-sm overflow-hidden flex-col md:flex-row relative transition-colors duration-300">

            {/* Mobile Header */}
            <div className="md:hidden h-12 bg-bg-secondary border-b border-border-color flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-2 font-bold text-text-primary uppercase tracking-widest text-[10px]">
                    <Terminal className="w-3 h-3" /> {roomId}
                </div>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 text-text-primary">
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
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-primary">Explorer</span>
                        <div className="flex gap-1">
                            <Plus onClick={createEditor} className="w-3.5 h-3.5 cursor-pointer text-text-primary hover:opacity-50 transition-opacity" />
                            <MoreHorizontal className="w-3.5 h-3.5 cursor-pointer text-text-primary hover:opacity-50" />
                        </div>
                    </div>
                    <button
                        onClick={shareLink}
                        className="w-full bg-bg-primary hover:opacity-80 text-text-primary border border-border-color text-[10px] font-bold py-2 flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-widest"
                    >
                        <Share2 className="w-3 h-3" />
                        {copyFeedback === 'Link Copied!' ? 'Link Copied' : 'Share Broadcast'}
                    </button>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto py-2">
                    {roomData.editors.map(editor => {
                        const isActive = activeEditorId === editor.editorId;
                        const isRenaming = renamingFileId === editor.editorId;
                        const IconComponent = ICON_MAP[editor.icon || 'FileText'];

                        return (
                            <div
                                key={editor.editorId}
                                onClick={() => handleFileOpen(editor.editorId)}
                                onDoubleClick={(e) => { e.stopPropagation(); setRenamingFileId(editor.editorId); setTempFileName(editor.name); }}
                                className={`flex items-center px-4 py-3 cursor-pointer text-[13px] group relative transition-all duration-200 border-l-2 ${isActive
                                    ? 'border-text-primary bg-bg-primary text-text-primary'
                                    : 'border-transparent hover:bg-black/5 text-text-secondary hover:text-text-primary'
                                    }`}
                            >
                                <div
                                    className="p-1.5 rounded-md transition-colors"
                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingIconEditorId(editor.editorId); setIsIconModalOpen(true); }}
                                >
                                    <IconComponent className="w-4 h-4" style={{ color: 'inherit' }} />
                                </div>

                                <div className="flex-1 min-w-0 ml-3">
                                    {isRenaming ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={tempFileName}
                                            onChange={(e) => setTempFileName(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-bg-secondary text-text-primary outline-none w-full border-b border-text-primary text-sm px-1 py-0.5"
                                        />
                                    ) : (
                                        <span className={`truncate block font-medium tracking-wide ${isActive ? 'text-text-primary' : ''}`}>{editor.name}</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 onClick={(e) => deleteFile(e, editor.editorId)} className="w-3.5 h-3.5 hover:text-red-500 transition-colors" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Sidebar Footer */}
                <div className="mt-auto border-t border-border-color">
                    <button
                        onClick={() => {
                            setShowCommentsPanel(true);
                            setActiveEditorId('comments');
                        }}
                        className={`w-full flex items-center gap-3 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeEditorId === 'comments' ? 'text-bg-primary bg-text-primary' : 'text-text-primary hover:opacity-50'}`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Discussions
                        {roomData.comments?.length > 0 && <span className={`ml-auto border px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeEditorId === 'comments' ? 'border-bg-primary' : 'border-text-primary'}`}>{roomData.comments.length}</span>}
                    </button>

                    <div className="p-3 px-6 flex items-center justify-between">
                        <div className="flex items-center gap-2 max-w-[80%] group">
                            <User className="w-3 h-3 text-text-primary" />
                            {isRenamingUser ? (
                                <input
                                    autoFocus
                                    className="bg-transparent outline-none text-text-primary w-full border-b border-border-color text-[11px]"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    onBlur={() => { setIsRenamingUser(false); socket.emit('rename-user', { roomId, newName: userName }); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { setIsRenamingUser(false); socket.emit('rename-user', { roomId, newName: userName }); } }}
                                />
                            ) : (
                                <span onDoubleClick={() => setIsRenamingUser(true)} className="text-[11px] font-bold text-text-primary cursor-text transition-colors">
                                    {userName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 flex flex-col min-w-0 relative">

                {/* HEADER INFO */}
                <div className="h-14 px-8 border-b border-border-color bg-bg-primary flex items-center justify-between shrink-0 gap-6">
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-secondary mb-0.5">Project</span>
                            <span className="text-sm font-bold font-mono text-text-primary tracking-tight">{roomId}</span>
                        </div>

                        <div className="relative group/collab">
                            <div className="flex flex-col cursor-pointer" onClick={() => setShowCollabList(!showCollabList)}>
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-secondary mb-0.5">Team</span>
                                <div className="flex items-center gap-2">
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                        {(collaborators.length > 0 ? collaborators : [{ name: userName }]).slice(0, 3).map((c, i) => (
                                            <div key={i} style={{ backgroundColor: getUserColor(c.name, currentTheme) }} className="w-4 h-4 rounded-full border border-bg-primary text-bg-primary flex items-center justify-center text-[7px] font-black z-10 transition-transform hover:scale-110 uppercase relative">
                                                {c.name?.[0]}
                                                {typingUsers[c.name] && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-text-primary rounded-full animate-pulse border border-bg-primary" />
                                                )}
                                            </div>
                                        ))}
                                        {collaborators.length > 3 && (
                                            <div className="w-4 h-4 rounded-full border border-bg-primary bg-bg-secondary text-text-secondary flex items-center justify-center text-[7px] font-bold z-0">
                                                +{collaborators.length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs font-medium text-text-primary">Active</span>
                                </div>
                            </div>

                            {/* Fixed Collaborators List UI */}
                            {showCollabList && (
                                <div className="absolute top-10 left-0 z-[60] bg-bg-primary border border-border-color rounded-lg shadow-2xl min-w-[180px] p-2 animate-in fade-in zoom-in-95 duration-200">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary mb-2 px-2 py-1">Active Members</p>
                                    <div className="space-y-0.5">
                                        {(collaborators.length > 0 ? collaborators : [{ name: userName }]).map((c, i) => (
                                            <div
                                                key={i}
                                                onClick={() => handleUserClick(c.name)}
                                                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-bg-secondary cursor-pointer transition-colors group/item"
                                            >
                                                <div style={{ backgroundColor: getUserColor(c.name, currentTheme) }} className="w-5 h-5 rounded border border-border-color flex items-center justify-center text-[9px] font-bold uppercase text-bg-primary transition-colors relative">
                                                    {c.name?.[0]}
                                                    {typingUsers[c.name] && (
                                                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-text-primary rounded-full animate-pulse border border-bg-primary" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-text-primary leading-none mb-0.5">{c.name}</span>
                                                    {c.name === userName && <span className="text-[9px] text-text-secondary leading-none">You</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 ml-auto">

                        <button onClick={toggleTheme} className="hover:opacity-80 transition-opacity">
                            {currentTheme === 'light' ? <Moon className="w-5 h-5 text-text-primary" /> : <Sun className="w-5 h-5 text-text-primary" />}
                        </button>
                        <div className="hidden sm:block h-4 w-[1px] bg-border-color" />
                        <a href="https://buymeacoffee.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center hover:opacity-80 transition-opacity">
                            <img src={bmcButton} alt="Buy me a coffee" className="h-8" />
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
                                        flex items-center h-full px-5 cursor-pointer transition-all relative flex-shrink flex-grow min-w-[100px] max-w-[200px] group/tab border-r-0
                                        ${isActive
                                            ? 'bg-bg-primary text-text-primary tab-active'
                                            : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-black/5'
                                        }
                                    `}
                                >
                                    <IconComp className="w-3 h-3 mr-2 shrink-0" style={{ color: 'inherit' }} />
                                    <span className="truncate flex-1 text-[11px] font-bold tracking-tight uppercase">{file.name}</span>
                                    <X
                                        onClick={(e) => handleFileClose(e, fid)}
                                        className="w-3 h-3 ml-2 opacity-0 group-hover/tab:opacity-100 hover:bg-bg-primary hover:text-text-primary p-0.5 cursor-pointer"
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* 3 Dots Menu */}
                    <div className="absolute right-2 flex items-center gap-1 bg-bg-secondary pl-2 z-[60]">
                        <button
                            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                            className="p-1 hover:opacity-50"
                        >
                            <MoreVertical className="w-4 h-4 text-text-primary" />
                        </button>

                        {moreMenuOpen && (
                            <div className="absolute top-10 right-0 z-50 bg-bg-secondary border border-border-color shadow-none p-2 min-w-[160px]">
                                <button onClick={closeAllTabs} className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-text-primary hover:text-bg-primary flex items-center gap-2">
                                    <FileMinus className="w-3 h-3" /> Close All Tabs
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 flex overflow-hidden">
                    {activeEditorId === 'comments' ? (
                        <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
                                <h2 className="text-xl font-black text-text-primary uppercase tracking-[0.2em] mb-12 flex items-center gap-4">
                                    Discussions
                                    <div className="h-1 flex-1 bg-border-color" />
                                </h2>

                                <div className="space-y-10 max-w-3xl border-l-2 border-border-color ml-4">
                                    {(roomData.comments || []).filter(c => !c.parentId).length === 0 ? (
                                        <div className="pl-8 text-text-primary font-black italic uppercase text-2xl tracking-tighter">Void...</div>
                                    ) : (
                                        (roomData.comments || []).filter(c => !c.parentId).map(c => (
                                            <div key={c.commentId} className="relative group pr-4 mb-8">
                                                {/* Left Decorative Line / Avatar */}
                                                <div style={{ backgroundColor: getUserColor(c.author, currentTheme) }} className="absolute -left-[11px] top-0 w-5 h-5 border-2 border-bg-primary flex items-center justify-center text-[8px] font-black text-bg-primary">
                                                    {c.author[0]}
                                                </div>

                                                <div className="pl-8">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-primary">{c.author}</span>
                                                        <span className="text-[8px] font-bold uppercase">{new Date(c.createdAt).toLocaleTimeString()}</span>

                                                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                                                            <button onClick={() => { setReplyingToId(replyingToId === c.commentId ? null : c.commentId); setReplyText(''); }} className="text-[8px] font-black text-text-primary uppercase border border-text-primary px-1">Reply</button>
                                                            {c.author === userName && (
                                                                <>
                                                                    <button onClick={() => { setEditingCommentId(c.commentId); setEditingCommentText(c.text) }} className="text-[8px] font-black text-text-primary uppercase border border-text-primary px-1">Edit</button>
                                                                    <button onClick={() => handleDeleteComment(c.commentId)} className="text-[8px] font-black text-text-primary uppercase border border-text-primary px-1">Delete</button>
                                                                </>
                                                            )}
                                                            <button onClick={() => handleFileOpen(c.editorId)} className="text-[8px] font-black text-text-primary uppercase border border-text-primary px-1">Jump</button>
                                                        </div>
                                                    </div>

                                                    {c.context && (
                                                        <div className="mb-2 pl-2 border-l-2 border-text-secondary opacity-70 text-[10px] italic font-mono bg-bg-secondary p-1">
                                                            {c.context}
                                                        </div>
                                                    )}

                                                    {editingCommentId === c.commentId ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                autoFocus
                                                                className="flex-1 bg-transparent border border-border-color px-2 py-1 text-xs outline-none text-text-primary"
                                                                value={editingCommentText}
                                                                onChange={(e) => setEditingCommentText(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && submitCommentEdit(c.commentId)}
                                                            />
                                                            <Check onClick={() => submitCommentEdit(c.commentId)} className="w-4 h-4 text-text-primary cursor-pointer" />
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-text-primary leading-relaxed max-w-xl mb-3">{renderCommentText(c.text)}</p>
                                                    )}

                                                    {/* Replies */}
                                                    <div className="space-y-4 mt-2">
                                                        {roomData.comments.filter(r => r.parentId === c.commentId).map(reply => (
                                                            <div key={reply.commentId} className="flex gap-3 relative group/reply">
                                                                <div className="absolute -left-[18px] top-0 w-[2px] h-full bg-border-color"></div>
                                                                <div style={{ backgroundColor: getUserColor(reply.author, currentTheme) }} className="w-4 h-4 shrink-0 rounded-full border border-bg-primary flex items-center justify-center text-[6px] font-black text-bg-primary z-10">
                                                                    {reply.author[0]}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <span className="text-[9px] font-bold uppercase text-text-primary">{reply.author}</span>
                                                                        <span className="text-[7px] font-medium opacity-50">{new Date(reply.createdAt).toLocaleTimeString()}</span>
                                                                        {reply.author === userName && (
                                                                            <button onClick={() => handleDeleteComment(reply.commentId)} className="ml-auto opacity-0 group-hover/reply:opacity-100 text-[7px] font-black uppercase text-red-500">Delete</button>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-text-primary leading-tight">{renderCommentText(reply.text)}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Reply Input */}
                                                {replyingToId === c.commentId && (
                                                    <div className="mt-3 flex gap-2 animate-in fade-in slide-in-from-top-1">
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handlePostReply(c.commentId)}
                                                            placeholder="Write a reply..."
                                                            className="flex-1 bg-bg-secondary border-none px-3 py-1.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-text-primary"
                                                        />
                                                        <button onClick={() => handlePostReply(c.commentId)} className="px-3 bg-text-primary text-bg-primary text-[9px] font-black uppercase">Send</button>
                                                    </div>
                                                )}
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
                                        className="flex-1 bg-bg-primary border border-border-color rounded-none px-6 py-3 text-sm focus:outline-none focus:border-text-primary transition-all text-text-primary"
                                    />
                                    <button
                                        onClick={handlePostDirectComment}
                                        className="bg-text-primary text-bg-primary p-3 hover:opacity-80 transition-opacity"
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
                            collaborators={collaborators}
                            theme={currentTheme}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-12 text-center">
                            <div className="w-24 h-24 border border-border-color rounded-full flex items-center justify-center mb-4">
                                <Terminal className="w-10 h-10 opacity-20 text-text-primary" />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-[0.4em] opacity-40 text-text-primary">Workspace Ready</h3>
                            <button onClick={createEditor} className="mt-4 px-8 py-3 bg-text-primary text-bg-primary text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform">Create New Module</button>
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
                                onClick={() => updateEditorStyle(editingIconEditorId, iconName, 'var(--text-primary)')}
                                className="p-4 bg-bg-primary border border-border-color hover:bg-text-primary hover:text-bg-primary flex items-center justify-center transition-all group"
                            >
                                {React.createElement(ICON_MAP[iconName], { className: "w-6 h-6" })}
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Notification Toast */}
            {
                mentionNotification && (
                    <div className="fixed bottom-6 right-6 z-[100] bg-bg-primary border border-text-primary shadow-2xl p-4 max-w-sm animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-text-primary text-bg-primary flex items-center justify-center font-black rounded-full shrink-0">
                                @
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black tracking-widest text-text-secondary mb-1">New Mention</p>
                                <p className="text-xs font-bold text-text-primary mb-1">{mentionNotification.author} mentioned you:</p>
                                <p className="text-xs text-text-primary opacity-80 italic line-clamp-2">"{mentionNotification.text}"</p>
                            </div>
                            <button onClick={() => setMentionNotification(null)} className="ml-auto text-text-primary hover:opacity-50">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default RoomPage;
