require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/live-clipboard';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Models
const Room = require('./models/Room');

// Routes
const roomRoutes = require('./routes/roomRoutes');
app.use('/api/rooms', roomRoutes);

// Socket.io logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    // Throttled save to DB (every 2 seconds)
    const editorSaveTimeouts = {};
    socket.on('editor-update', async ({ roomId, editorId, content }) => {
        socket.to(roomId).emit('editor-remote-update', { editorId, content, socketId: socket.id });

        const key = `${roomId}-${editorId}`;
        if (editorSaveTimeouts[key]) return;

        editorSaveTimeouts[key] = setTimeout(async () => {
            try {
                await Room.findOneAndUpdate(
                    { roomId, 'editors.editorId': editorId },
                    { $set: { 'editors.$.content': content } }
                );
            } catch (err) {
                console.error('Error saving editor content:', err);
            }
            delete editorSaveTimeouts[key];
        }, 2000);
    });

    // Notify room of structural changes (new editor, rename, etc.)
    socket.on('room-structure-update', ({ roomId }) => {
        socket.to(roomId).emit('room-remote-data-refetch');
    });

    socket.on('rename-editor', async ({ roomId, editorId, newName }) => {
        try {
            await Room.findOneAndUpdate(
                { roomId, 'editors.editorId': editorId },
                { $set: { 'editors.$.name': newName } }
            );
            socket.to(roomId).emit('room-remote-data-refetch');
        } catch (err) {
            console.error('Error renaming editor:', err);
        }
    });

    socket.on('update-editor-style', async ({ roomId, editorId, icon, iconColor }) => {
        try {
            await Room.findOneAndUpdate(
                { roomId, 'editors.editorId': editorId },
                { $set: { 'editors.$.icon': icon, 'editors.$.iconColor': iconColor } }
            );
            socket.to(roomId).emit('room-remote-data-refetch');
        } catch (err) {
            console.error('Error updating editor style:', err);
        }
    });

    socket.on('add-comment', async ({ roomId, comment }) => {
        try {
            await Room.findOneAndUpdate(
                { roomId },
                { $push: { comments: comment } }
            );
            socket.to(roomId).emit('new-comment', comment);
        } catch (err) {
            console.error('Error adding comment:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
