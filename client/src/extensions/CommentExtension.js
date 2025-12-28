import { Mark, mergeAttributes } from '@tiptap/core';

export const Comment = Mark.create({
    name: 'comment',

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-comment-id'),
                renderHTML: attributes => {
                    if (!attributes.id) return {};
                    return { 'data-comment-id': attributes.id };
                },
            },
            author: {
                default: null,
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-comment-id]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'comment-mark' }), 0];
    },

    addCommands() {
        return {
            setComment: (id) => ({ commands }) => {
                return commands.setMark(this.name, { id });
            },
            unsetComment: () => ({ commands }) => {
                return commands.unsetMark(this.name);
            },
        };
    },
});
