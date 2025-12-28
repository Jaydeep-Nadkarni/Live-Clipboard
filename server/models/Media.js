const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
    roomId: { type: String, required: true },
    name: String,
    type: String, // 'image' or 'audio'
    data: Buffer,
    contentType: String,
    size: Number,
    createdAt: { type: Date, default: Date.now, expires: 86400 } // TTL 24h
});

module.exports = mongoose.model('Media', MediaSchema);
