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

// Strict B&W Highlight - just use opacity
const HIGHLIGHT_COLOR = 'var(--text-primary)';

const Editor = ({ content, onUpdate, socket, roomId, editorId, userName, onAddComment, collaborators = [] }) => {
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [copyFeedback, setCopyFeedback] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Type something to collaborate... Use @ to mention',
            }),
            Highlight.configure({ multicolor: true }),
            BubbleMenuExtension,
            Comment,
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention',
                },
                suggestion: {
                    items: ({ query }) => {
                        const users = collaborators.length > 0 ? collaborators.map(c => c.name) : [userName];
                        return users.filter(item => item.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);
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
                    onClick={() => editor.chain().focus().toggleHighlight({ color: 'rgba(128,128,128,0.3)' }).run()}
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
