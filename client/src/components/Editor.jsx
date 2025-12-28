import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import { Comment } from '../extensions/CommentExtension';
import {
    Bold, Italic, MessageSquare, Highlighter,
    Link as LinkIcon, Trash2, Check, Copy, MoreVertical
} from 'lucide-react';
import Modal from './Modal';

const HIGHLIGHT_COLORS = [
    { name: 'Yellow', color: '#ffeb3b40' },
    { name: 'Green', color: '#4caf5040' },
    { name: 'Blue', color: '#2196f340' },
    { name: 'Red', color: '#f4433640' },
    { name: 'Purple', color: '#9c27b040' },
    { name: 'Gray', color: '#ffffff20' }
];

const Editor = ({ content, onUpdate, socket, roomId, editorId, userName, onAddComment }) => {
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [copyFeedback, setCopyFeedback] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Type something to collaborate...',
            }),
            Highlight.configure({ multicolor: true }),
            BubbleMenuExtension,
            Comment,
        ],
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-full font-mono text-[14px] leading-relaxed p-8 pt-4 transition-colors duration-300',
            }
        },
        content: content || '',
        onUpdate: ({ editor }) => {
            const json = editor.getJSON();
            if (typeof onUpdate === 'function') onUpdate(json);
            if (socket) {
                socket.emit('editor-update', { roomId, editorId, content: json });
            }
        },
    });

    useEffect(() => {
        if (!editor || !socket) return;
        const handleRemoteUpdate = (data) => {
            if (data.editorId === editorId && data.socketId !== socket.id) {
                const currentJSON = JSON.stringify(editor.getJSON());
                const newJSON = JSON.stringify(data.content);
                if (currentJSON !== newJSON) {
                    editor.commands.setContent(data.content, false);
                }
            }
        };
        socket.on('editor-remote-update', handleRemoteUpdate);
        return () => socket.off('editor-remote-update', handleRemoteUpdate);
    }, [editor, socket, editorId]);

    useEffect(() => {
        if (editor && content) {
            const currentJSON = JSON.stringify(editor.getJSON());
            const newJSON = JSON.stringify(content);
            if (currentJSON !== newJSON) {
                editor.commands.setContent(content, false);
            }
        }
    }, [editor, content]);

    const handleCopy = () => {
        const text = editor.getText();
        navigator.clipboard.writeText(text);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
    };

    const handleAddComment = () => {
        if (!commentText.trim()) return;
        const commentId = Math.random().toString(36).substring(2, 9);
        editor.chain().focus().setComment(commentId).run();

        const newComment = {
            commentId,
            editorId,
            text: commentText,
            author: userName,
            createdAt: new Date().toISOString()
        };

        if (socket) socket.emit('add-comment', { roomId, comment: newComment });
        if (onAddComment) onAddComment(newComment);

        setCommentText('');
        setIsCommentModalOpen(false);
    };

    if (!editor) return null;

    return (
        <div className="h-full w-full relative flex flex-col group">

            {/* Action Bar inside Editor */}
            <div className="absolute top-4 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button
                    onClick={handleCopy}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md"
                >
                    {copyFeedback ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copyFeedback ? 'Copied' : 'Copy File'}
                </button>
            </div>

            <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex overflow-hidden items-center bg-[#111] border border-[#222] p-1 rounded-lg shadow-2xl">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 hover:bg-[#222] rounded ${editor.isActive('bold') ? 'text-white' : 'text-[#444]'}`}
                >
                    <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 hover:bg-[#222] rounded ${editor.isActive('italic') ? 'text-white' : 'text-[#444]'}`}
                >
                    <Italic className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-[#222] mx-1" />

                {/* Multi-Color Highlight Picker */}
                <div className="flex gap-0.5 px-1">
                    {HIGHLIGHT_COLORS.map(h => (
                        <button
                            key={h.name}
                            onClick={() => editor.chain().focus().toggleHighlight({ color: h.color }).run()}
                            className="w-4 h-4 rounded-full border border-white/10 hover:scale-110 transition-transform"
                            style={{ backgroundColor: h.color }}
                            title={h.name}
                        />
                    ))}
                </div>

                <div className="w-[1px] h-4 bg-[#222] mx-1" />
                <button
                    onClick={() => setIsCommentModalOpen(true)}
                    className="p-2 hover:bg-[#222] rounded text-[#444] hover:text-white"
                >
                    <MessageSquare className="w-3.5 h-3.5" />
                </button>
            </BubbleMenu>

            <EditorContent
                editor={editor}
                className="flex-1 overflow-y-auto outline-none"
            />

            <Modal
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
                title="Context Discussion"
            >
                <div className="space-y-4">
                    <textarea
                        autoFocus
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Start a thread on this selection... Use @ to mention anyone (UI only)"
                        className="w-full h-32 bg-transparent border border-white/10 p-3 text-sm focus:outline-none focus:border-white/20 rounded-lg resize-none"
                    />
                    <button
                        onClick={handleAddComment}
                        className="w-full bg-accent text-bg-primary font-bold py-2 rounded-lg text-xs uppercase tracking-widest hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                    >
                        Post Discussion
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Editor;
