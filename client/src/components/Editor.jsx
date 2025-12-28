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
    Link as LinkIcon, Trash2, Check
} from 'lucide-react';
import Modal from './Modal';

const Editor = ({ content, onUpdate, socket, roomId, editorId, userName, onAddComment }) => {
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [commentText, setCommentText] = useState('');

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Start typing documents...',
            }),
            Highlight.configure({ multicolor: true }),
            BubbleMenuExtension,
            Comment,
        ],
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-full text-[#cccccc] font-mono text-[14px] leading-relaxed p-8 pt-4',
            }
        },
        content: content || '',
        onUpdate: ({ editor }) => {
            const json = editor.getJSON();
            onUpdate(json);
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

    // Handle initial content load
    useEffect(() => {
        if (editor && content) {
            const currentJSON = JSON.stringify(editor.getJSON());
            const newJSON = JSON.stringify(content);
            if (currentJSON !== newJSON) {
                editor.commands.setContent(content, false);
            }
        }
    }, [editor, content]);

    const handleAddComment = () => {
        if (!commentText.trim()) return;
        const commentId = Math.random().toString(36).substring(2, 9);

        // Wrap selected text with comment mark
        editor.chain().focus().setComment(commentId).run();

        const newComment = {
            commentId,
            editorId,
            text: commentText,
            author: userName,
            createdAt: new Date().toISOString()
        };

        if (socket) {
            socket.emit('add-comment', { roomId, comment: newComment });
        }

        if (onAddComment) onAddComment(newComment);

        setCommentText('');
        setIsCommentModalOpen(false);
    };

    if (!editor) return null;

    return (
        <div className="h-full w-full bg-black relative flex flex-col">
            <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex items-center gap-1 bg-[#111] border border-[#222] p-1 rounded-lg shadow-2xl">
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
                <button
                    onClick={() => editor.chain().focus().toggleHighlight({ color: '#ffffff20' }).run()}
                    className={`p-2 hover:bg-[#222] rounded ${editor.isActive('highlight') ? 'text-white' : 'text-[#444]'}`}
                >
                    <Highlighter className="w-3.5 h-3.5" />
                </button>
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
                title="Add Comment"
            >
                <div className="space-y-4">
                    <textarea
                        autoFocus
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Type your comment..."
                        className="w-full h-32 bg-[#000] border border-[#222] p-3 text-sm text-white focus:outline-none focus:border-[#444] rounded-lg resize-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddComment}
                            className="flex-1 bg-white text-black font-bold py-2 rounded-lg text-xs uppercase tracking-widest hover:bg-[#ccc] transition-colors"
                        >
                            Post Comment
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Editor;
