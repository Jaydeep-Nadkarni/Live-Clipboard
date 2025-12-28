const mongoose = require('mongoose');

const EditorSchema = new mongoose.Schema({
    editorId: { type: String, required: true },
    name: { type: String, default: 'Untitled Editor' },
    content: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const WhiteboardActionSchema = new mongoose.Schema({
    type: String, // 'stroke-start', 'stroke-move', 'stroke-end', 'clear'
    data: mongoose.Schema.Types.Mixed
});

const MediaSchema = new mongoose.Schema({
    type: { type: String, enum: ['image', 'audio'] },
    url: String,
    size: Number,
    name: String
});

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    editors: [EditorSchema],
    whiteboard: [WhiteboardActionSchema],
    media: [MediaSchema],
    totalMediaSize: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 hours in seconds
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
