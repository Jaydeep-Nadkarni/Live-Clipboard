import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';

import { Comment } from '../extensions/CommentExtension';
import MentionList from './MentionList';
import {
    Bold, Italic, MessageSquare, Highlighter,
    Link as LinkIcon, Trash2, Check, Copy, MoreVertical
} from 'lucide-react';
import Modal from './Modal';

import { CursorExtension, cursorPluginKey } from '../extensions/CursorExtension';

// Strict B&W Highlight - just use opacity
const HIGHLIGHT_COLOR = 'var(--text-primary)';

const getUserColor = (username, theme) => {
    if (!username) return 'var(--text-primary)';
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    const s = 80;
    const l = theme === 'dark' ? 75 : 40;
    return `hsl(${h}, ${s}%, ${l}%)`;
};

function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function (...args) {
        if (!lastRan) {
            func.apply(this, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    }
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

const Editor = ({ content, onUpdate, socket, roomId, editorId, userName, onAddComment, collaborators = [], theme }) => {
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [remoteCursors, setRemoteCursors] = useState({});

    const emitCursor = React.useRef(throttle((socket, roomId, editorId, userName, selection) => {
        if (socket) {
            socket.emit('cursor-update', {
                roomId,
                editorId,
                cursor: { head: selection.head, anchor: selection.anchor },
                user: { name: userName }
            });
        }
    }, 50)).current;

    const emitTyping = React.useRef(throttle((socket, roomId, userName, isTyping) => {
        if (socket) {
            socket.emit('typing-update', { roomId, user: { name: userName }, isTyping });
        }
    }, 1000)).current;

    const stopTyping = React.useRef(debounce((socket, roomId, userName) => {
        if (socket) {
            socket.emit('typing-update', { roomId, user: { name: userName }, isTyping: false });
        }
    }, 2000)).current;

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Type something to collaborate... Use @ to mention',
            }),
            Highlight.configure({ multicolor: true }),
            BubbleMenuExtension,
            CursorExtension, // Custom Cursor Extension
            Comment,
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention',
                },
                suggestion: {
                    items: ({ query }) => {
                        const users = collaborators.length > 0 ? collaborators : [{ name: userName }];
                        return users
                            .filter(u => u.name.toLowerCase().startsWith(query.toLowerCase()))
                            .slice(0, 5)
                            .map(u => ({
                                label: u.name,
                                color: getUserColor(u.name, theme)
                            }));
                    },
                    render: () => {
                        let component;
                        let popup;

                        return {
                            onStart: props => {
                                component = new ReactRenderer(MentionList, {
                                    props,
                                    editor: props.editor,
                                });

                                if (!props.clientRect) return;

                                popup = tippy('body', {
                                    getReferenceClientRect: props.clientRect,
                                    appendTo: () => document.body,
                                    content: component.element,
                                    showOnCreate: true,
                                    interactive: true,
                                    trigger: 'manual',
                                    placement: 'bottom-start',
                                });
                            },
                            onUpdate(props) {
                                component.updateProps(props);
                                if (!props.clientRect) return;
                                popup[0].setProps({
                                    getReferenceClientRect: props.clientRect,
                                });
                            },
                            onKeyDown(props) {
                                if (props.event.key === 'Escape') {
                                    popup[0].hide();
                                    return true;
                                }
                                return component.ref?.onKeyDown(props);
                            },
                            onExit() {
                                popup[0].destroy();
                                component.destroy();
                            },
                        };
                    },
                },
            }),
        ],
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-full font-mono text-[14px] leading-relaxed p-8 pt-4 transition-colors duration-300 text-text-primary',
            }
        },
        content: content || '',
        onUpdate: ({ editor }) => {
            const json = editor.getJSON();
            if (typeof onUpdate === 'function') onUpdate(json);
            if (socket) {
                socket.emit('editor-update', { roomId, editorId, content: json });
                emitTyping(socket, roomId, userName, true);
                stopTyping(socket, roomId, userName);
                emitCursor(socket, roomId, editorId, userName, editor.state.selection);
            }
        },
        onSelectionUpdate: ({ editor }) => {
            emitCursor(socket, roomId, editorId, userName, editor.state.selection);
        }
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
        const handleRemoteCursor = ({ editorId: eId, cursor, user, socketId }) => {
            if (eId !== editorId) return;
            setRemoteCursors(prev => ({ ...prev, [socketId]: { cursor, user } }));
        };

        socket.on('editor-remote-update', handleRemoteUpdate);
        socket.on('remote-cursor-update', handleRemoteCursor);

        return () => {
            socket.off('editor-remote-update', handleRemoteUpdate);
            socket.off('remote-cursor-update', handleRemoteCursor);
        };
    }, [editor, socket, editorId]);

    // Update cursors in editor
    useEffect(() => {
        if (!editor) return;
        const cursors = Object.values(remoteCursors).map(c => ({
            ...c,
            user: { ...c.user, color: getUserColor(c.user.name, theme) }
        }));

        try {
            const tr = editor.state.tr;
            tr.setMeta(cursorPluginKey, { type: 'update', cursors });
            editor.view.dispatch(tr);
        } catch (e) {
            console.error('Error dispatching cursor update:', e);
        }
    }, [remoteCursors, editor, theme]);

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

        const { from, to } = editor.state.selection;
        const context = editor.state.doc.textBetween(from, to, ' ');

        const newComment = {
            commentId,
            editorId,
            text: commentText,
            author: userName,
            context,
            parentId: null,
            createdAt: new Date().toISOString()
        };

        if (socket) socket.emit('add-comment', { roomId, comment: newComment });
        if (onAddComment) onAddComment(newComment);

        setCommentText('');
        setIsCommentModalOpen(false);
    };

    if (!editor) return null;

    return (
        <div className="h-full w-full relative flex flex-col group bg-bg-primary">

            {/* Action Bar inside Editor */}
            <div className="absolute top-4 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button
                    onClick={handleCopy}
                    className="p-2 bg-bg-primary border border-border-color rounded-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-text-primary hover:text-bg-primary transition-colors"
                >
                    {copyFeedback ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copyFeedback ? 'Copied' : 'Copy File'}
                </button>
            </div>

            <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex overflow-hidden items-center bg-bg-primary border border-text-primary p-1 shadow-none">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 hover:bg-text-primary hover:text-bg-primary transition-colors ${editor.isActive('bold') ? 'bg-text-primary text-bg-primary' : 'text-text-primary'}`}
                >
                    <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 hover:bg-text-primary hover:text-bg-primary transition-colors ${editor.isActive('italic') ? 'bg-text-primary text-bg-primary' : 'text-text-primary'}`}
                >
                    <Italic className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-border-color mx-1" />

                {/* Single B&W Highlight Toggle */}
                <button
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                    className={`p-2 hover:bg-text-primary hover:text-bg-primary transition-colors ${editor.isActive('highlight') ? 'bg-text-primary text-bg-primary' : 'text-text-primary'}`}
                >
                    <Highlighter className="w-3.5 h-3.5" />
                </button>

                <div className="w-[1px] h-4 bg-border-color mx-1" />
                <button
                    onClick={() => setIsCommentModalOpen(true)}
                    className="p-2 hover:bg-text-primary hover:text-bg-primary text-text-primary transition-colors"
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
                        placeholder="Start a thread on this selection..."
                        className="w-full h-32 bg-transparent border border-border-color p-3 text-sm focus:outline-none focus:border-text-primary text-text-primary resize-none"
                    />
                    <button
                        onClick={handleAddComment}
                        className="w-full bg-text-primary text-bg-primary font-bold py-2 text-xs uppercase tracking-widest hover:opacity-80 transition-opacity"
                    >
                        Post Discussion
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Editor;
