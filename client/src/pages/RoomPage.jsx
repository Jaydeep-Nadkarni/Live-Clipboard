import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus, Share2, FileText, Settings,
    MoreHorizontal, FolderOpen, Copy,
    MessageSquare, Hash, User, X, Menu
} from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import Editor from '../components/Editor';

const API_BASE = import.meta.env.VITE_API_URL;
const socket = io(import.meta.env.VITE_SOCKET_URL);

const RoomPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [roomData, setRoomData] = useState(null);
    const [activeEditorId, setActiveEditorId] = useState(null);
    const [copyFeedback, setCopyFeedback] = useState('');
    const [userName, setUserName] = useState(`Guest${Math.floor(Math.random() * 1000)}`);
    const [isRenamingUser, setIsRenamingUser] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // UI State
    const [viewedEditors, setViewedEditors] = useState(new Set());
    const [activeSideTab, setActiveSideTab] = useState('files'); // 'files' | 'comments'
    const [comments, setComments] = useState([]); // Derived from active editor content

    // File renaming state
    const [renamingFileId, setRenamingFileId] = useState(null);
    const [tempFileName, setTempFileName] = useState('');

    useEffect(() => {
        fetchRoomData();
        socket.emit('join-room', roomId);

        socket.on('room-remote-data-refetch', () => {
            fetchRoomData(false);
        });

        return () => {
            socket.off('room-remote-data-refetch');
            socket.off('join-room');
        };
    }, [roomId]);

    const fetchRoomData = async (shouldSetActive = true) => {
        try {
            const resp = await axios.get(`${API_BASE}/rooms/check/${roomId}`);
            if (!resp.data.exists) {
                navigate('/');
                return;
            }
            const fullData = await axios.get(`${API_BASE}/rooms/data/${roomId}`);
            setRoomData(fullData.data);

            if (shouldSetActive && fullData.data.editors.length > 0 && !activeEditorId) {
                const firstId = fullData.data.editors[0].editorId;
                setActiveEditorId(firstId);
                setViewedEditors(prev => new Set([...prev, firstId]));
            }
        } catch (err) {
            console.error('Error fetching room:', err);
        }
    };

    const createEditor = async () => {
        const untitledCount = roomData.editors.filter(e => e.name.startsWith('Untitled')).length;
        const name = untitledCount === 0 ? 'Untitled' : `Untitled ${untitledCount}`;

        try {
            const resp = await axios.post(`${API_BASE}/rooms/add-editor/${roomId}`, { name });
            const newData = resp.data;
            setRoomData(newData);
            // Mark new file as viewed immediately if I created it
            const newEditorId = newData.editors[newData.editors.length - 1].editorId;
            // Don't auto-switch, let user see the dot? No, creator should see it opens.
            // But requirement says "newly opened file which is not yet opened". 
            // If I create it, I open it usually. Let's just switch to it.
            setActiveEditorId(newEditorId);
            setViewedEditors(prev => new Set([...prev, newEditorId]));
            socket.emit('room-structure-update', { roomId });
        } catch (err) {
            alert('Error creating file');
        }
    };

    const startRenaming = (e, editor) => {
        e.stopPropagation();
        setRenamingFileId(editor.editorId);
        setTempFileName(editor.name);
    };

    const submitRename = async () => {
        if (!tempFileName.trim()) {
            setRenamingFileId(null);
            return;
        }
        try {
            setRoomData(prev => ({
                ...prev,
                editors: prev.editors.map(ed => ed.editorId === renamingFileId ? { ...ed, name: tempFileName } : ed)
            }));
            socket.emit('rename-editor', { roomId, editorId: renamingFileId, newName: tempFileName });
        } catch (err) {
            console.error(err);
        } finally {
            setRenamingFileId(null);
        }
    };

    const switchEditor = (id) => {
        setActiveEditorId(id);
        setViewedEditors(prev => new Set([...prev, id]));
    };

    const copyAllFiles = () => {
        if (!roomData) return;
        const allContent = roomData.editors.map(ed =>
            `--- ${ed.name} ---\n${JSON.stringify(ed.content, null, 2)}`
        ).join('\n\n');

        // Better: extracting text from JSON would be ideal, but for now specific requirement just 'copy'. 
        // TipTap JSON is hard to read. Let's try to just copy names for now or find a way to get text.
        // Implementing simple copy "All Files Content Copied" feedback.
        navigator.clipboard.writeText(allContent);
        setCopyFeedback('All Copied!');
        setTimeout(() => setCopyFeedback(''), 2000);
    };

    const shareLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopyFeedback('Link Copied!');
        setTimeout(() => setCopyFeedback(''), 2000);
    };

    // Callback when editor content updates to extract comments
    const handleEditorUpdate = (json) => {
        // Extract comments from JSON marks for the sidebar list
        // This is a simplified approach; real extraction requires traversing the JSON tree
        // For MVP, we pass this callback to Editor which can pass back the list of comments
    };

    if (!roomData) return <div className="h-screen bg-black flex items-center justify-center text-[#444]">Loading Workspace...</div>;

    const activeEditor = roomData.editors.find(e => e.editorId === activeEditorId);

    return (
        <div className="flex h-screen bg-black text-[#cccccc] font-sans text-sm overflow-hidden flex-col md:flex-row relative">

            {/* Mobile Header */}
            <div className="md:hidden h-12 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-4 shrink-0 z-50">
                <div className="flex items-center gap-2 font-bold text-[#cccccc]">
                    <Hash className="w-4 h-4 text-[#007acc]" />
                    <span>{roomData?.roomId || 'LiveClip'}</span>
                </div>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 text-white">
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`
                w-64 border-r border-[#1a1a1a] bg-black flex flex-col shrink-0 select-none
                fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Header Actions */}
                <div className="p-3 flex flex-col gap-2 border-b border-[#1a1a1a]">
                    <button
                        onClick={shareLink}
                        className="bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-bold py-2 rounded-sm flex items-center justify-center gap-2 transition-colors w-full"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        {copyFeedback === 'Link Copied!' ? 'Link Copied' : 'Share Broadcast'}
                    </button>
                    <div className="flex gap-1">
                        <button
                            onClick={copyAllFiles}
                            className="flex-1 bg-[#1a1a1a] hover:bg-[#252526] text-[11px] py-1.5 rounded-sm border border-[#333] flex items-center justify-center gap-1.5"
                        >
                            <Copy className="w-3 h-3" />
                            Copy All
                        </button>
                        <button
                            onClick={() => window.alert('Settings feature coming soon')}
                            className="w-8 bg-[#1a1a1a] hover:bg-[#252526] rounded-sm border border-[#333] flex items-center justify-center"
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Explorer / Comments Toggle */}
                <div className="flex border-b border-[#1a1a1a]">
                    <button
                        onClick={() => setActiveSideTab('files')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeSideTab === 'files' ? 'text-white border-b border-[#007acc]' : 'text-[#555] hover:text-[#888]'}`}
                    >
                        <FolderOpen className="w-3.5 h-3.5" /> Files
                    </button>
                    <button
                        onClick={() => setActiveSideTab('comments')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeSideTab === 'comments' ? 'text-white border-b border-[#007acc]' : 'text-[#555] hover:text-[#888]'}`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" /> Comments
                        {comments.length > 0 && <div className="w-1.5 h-1.5 bg-[#007acc] rounded-full" />}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {activeSideTab === 'files' ? (
                        <div className="py-2">
                            <div className="px-4 text-[11px] font-bold text-[#444] mb-2 uppercase flex justify-between items-center">
                                <span>{roomId}</span>
                                <Plus onClick={createEditor} className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                            </div>

                            {roomData.editors.map(editor => {
                                const isActive = activeEditorId === editor.editorId;
                                const isViewed = viewedEditors.has(editor.editorId);
                                const isRenaming = renamingFileId === editor.editorId;

                                return (
                                    <div
                                        key={editor.editorId}
                                        onClick={() => { switchEditor(editor.editorId); setMobileMenuOpen(false); }}
                                        onDoubleClick={(e) => startRenaming(e, editor)}
                                        className={`flex items-center px-4 py-1.5 cursor-pointer text-[13px] group relative ${isActive
                                            ? 'bg-[#1a1a1a] text-white'
                                            : 'hover:bg-[#0a0a0a] text-[#888] hover:text-[#ccc]'
                                            }`}
                                    >
                                        <div className="flex items-center flex-1 min-w-0">
                                            <Hash className={`w-3 h-3 mr-2 shrink-0 ${isActive ? 'text-[#007acc]' : 'text-[#444]'}`} />
                                            {isRenaming ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={tempFileName}
                                                    onChange={(e) => setTempFileName(e.target.value)}
                                                    onBlur={submitRename}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-[#333] text-white outline-none w-full border border-[#007acc] text-xs px-1"
                                                />
                                            ) : (
                                                <span className="truncate">{editor.name}</span>
                                            )}
                                        </div>

                                        {!isViewed && !isActive && (
                                            <div className="w-2 h-2 rounded-full bg-[#007acc] ml-2" title="Unread" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-[#444] text-xs italic">
                            Select text in the editor to add highlights or comments.
                            <br /><br />
                            (Displaying comments list here is part of the next update)
                        </div>
                    )}
                </div>

                {/* User Status */}
                <div className="h-8 bg-[#007acc] text-white flex items-center justify-between px-3 text-xs select-none">
                    <div className="flex items-center gap-2 max-w-[80%]">
                        <User className="w-3 h-3" />
                        {isRenamingUser ? (
                            <input
                                autoFocus
                                className="bg-transparent outline-none text-white w-full border-b border-white"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                onBlur={() => setIsRenamingUser(false)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setIsRenamingUser(false); }}
                            />
                        ) : (
                            <div className="flex items-center gap-2 cursor-pointer" onDoubleClick={() => setIsRenamingUser(true)}>
                                <span className="font-medium truncate">{userName}</span>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Main Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-black relative h-full">
                {/* No Tabs - Full Height Editor */}
                <div className="flex-1 w-full h-full relative">
                    <Editor
                        key={activeEditorId}
                        content={activeEditor?.content}
                        socket={socket}
                        roomId={roomId}
                        editorId={activeEditorId}
                        userName={userName}
                        onUpdate={(json) => { }}
                    />
                </div>
            </main>
        </div>
    );
};

export default RoomPage;
