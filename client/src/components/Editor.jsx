import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import { Bold, Italic, MessageSquare, Highlighter } from 'lucide-react';

const Editor = ({ content, onUpdate, socket, roomId, editorId, userName }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Start typing...',
            }),
            Highlight.configure({ multicolor: true }),
            BubbleMenuExtension,
        ],
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-screen text-[#cccccc] font-mono text-[14px] leading-relaxed p-4',
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

    const setHighlight = () => {
        editor.chain().focus().toggleHighlight({ color: '#ffc10740' }).run();
        // In a real implementation, we would attach a comment ID here
    };

    const addComment = () => {
        const comment = prompt("Enter your comment:");
        if (comment) {
            // For now, simple highlight to indicate comment. 
            // Real implementation requires a custom 'comment' mark extension.
            editor.chain().focus().toggleHighlight({ color: '#007acc40' }).run();
        }
    };

    if (!editor) {
        return (
            <div className="flex items-center justify-center h-full text-[#333]">
                <span className="animate-pulse">Loading Editor Core...</span>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-black relative">
            <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex items-center gap-1 bg-[#252526] border border-[#3e3e42] p-1 rounded shadow-xl">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-1.5 hover:bg-[#3e3e42] rounded ${editor.isActive('bold') ? 'text-white' : 'text-[#888]'}`}
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-1.5 hover:bg-[#3e3e42] rounded ${editor.isActive('italic') ? 'text-white' : 'text-[#888]'}`}
                >
                    <Italic className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-[#3e3e42] mx-1" />
                <button
                    onClick={setHighlight}
                    className={`p-1.5 hover:bg-[#3e3e42] rounded ${editor.isActive('highlight', { color: '#ffc10740' }) ? 'text-yellow-400' : 'text-[#888]'}`}
                    title="Highlight"
                >
                    <Highlighter className="w-4 h-4" />
                </button>
                <button
                    onClick={addComment}
                    className={`p-1.5 hover:bg-[#3e3e42] rounded hover:text-[#007acc] text-[#888]`}
                    title="Comment"
                >
                    <MessageSquare className="w-4 h-4" />
                </button>
            </BubbleMenu>

            <EditorContent
                editor={editor}
                className="h-full outline-none"
            />
        </div>
    );
};

export default Editor;
