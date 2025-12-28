import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const cursorPluginKey = new PluginKey('cursor');

export const CursorExtension = Extension.create({
    name: 'cursor',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: cursorPluginKey,
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, set) {
                        // Map existing decorations first so they stay with text
                        set = set.map(tr.mapping, tr.doc);
                        const action = tr.getMeta(cursorPluginKey);
                        if (action && action.type === 'update') {
                            const { cursors } = action; // Array of { cursor: { head, anchor }, user: { name, color } }
                            const decorations = [];

                            cursors.forEach(c => {
                                if (c.cursor && typeof c.cursor.head === 'number') {
                                    // Ensure visual position is within bounds
                                    const pos = Math.min(Math.max(0, c.cursor.head), tr.doc.content.size);

                                    const el = document.createElement('span');
                                    el.classList.add('remote-cursor');
                                    el.style.borderLeft = `2px solid ${c.user.color || '#000'}`;
                                    el.style.marginLeft = '-1px';

                                    const label = document.createElement('div');
                                    label.textContent = c.user.name;
                                    label.classList.add('remote-cursor-label');
                                    label.style.backgroundColor = c.user.color || '#000';

                                    el.appendChild(label);

                                    decorations.push(Decoration.widget(pos, el));
                                }
                            });

                            return DecorationSet.create(tr.doc, decorations);
                        }
                        return set;
                    }
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    }
                }
            })
        ];
    }
});
