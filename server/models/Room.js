const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    commentId: { type: String, required: true },
    editorId: { type: String, required: true },
    text: { type: String, required: true },
    author: { type: String, required: true },
    selection: { type: mongoose.Schema.Types.Mixed }, // Stores TiPTap range/pos info
    createdAt: { type: Date, default: Date.now }
});

const EditorSchema = new mongoose.Schema({
    editorId: { type: String, required: true },
    name: { type: String, default: 'Untitled' },
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
    icon: { type: String, default: 'FileText' },
    iconColor: { type: String, default: '#888888' }
});

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    editors: [EditorSchema],
    comments: [CommentSchema],
    createdAt: { type: Date, default: Date.now, expires: 86400 }
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
