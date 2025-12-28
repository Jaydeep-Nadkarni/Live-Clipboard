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
const roomsUsers = {}; // roomId -> { socketId: { name } }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId, userData) => {
        socket.join(roomId);

        if (!roomsUsers[roomId]) roomsUsers[roomId] = {};
        roomsUsers[roomId][socket.id] = { name: userData?.name || 'Guest' };

        // Broadcast new user list
        io.to(roomId).emit('collaborators-update', Object.values(roomsUsers[roomId]));

        console.log(`User ${socket.id} (${roomsUsers[roomId][socket.id].name}) joined room ${roomId}`);
    });

    socket.on('rename-user', ({ roomId, newName }) => {
        if (roomsUsers[roomId] && roomsUsers[roomId][socket.id]) {
            roomsUsers[roomId][socket.id].name = newName;
            io.to(roomId).emit('collaborators-update', Object.values(roomsUsers[roomId]));
        }
    });

    // Throttled save to DB (every 2 seconds)
    const editorSaveTimeouts = {};
    socket.on('editor-update', async ({ roomId, editorId, content, user, timestamp }) => {
        // Broadcast the update with metadata for conflict resolution
        socket.to(roomId).emit('editor-remote-update', {
            editorId,
            content,
            user: user || (roomsUsers[roomId]?.[socket.id] ? { name: roomsUsers[roomId][socket.id].name } : undefined),
            timestamp: timestamp || Date.now(),
            socketId: socket.id
        });

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

    socket.on('delete-editor', async ({ roomId, editorId }) => {
        try {
            await Room.findOneAndUpdate(
                { roomId },
                { $pull: { editors: { editorId } } }
            );
            socket.to(roomId).emit('room-remote-data-refetch');
        } catch (err) {
            console.error('Error deleting editor:', err);
        }
    });

    socket.on('add-comment', async ({ roomId, comment }) => {
        try {
            await Room.findOneAndUpdate(
                { roomId },
                { $push: { comments: comment } }
            );
            socket.to(roomId).emit('new-comment', comment);

            // Detect mentions and notify
            const mentionRegex = /@(\w+)/g;
            let match;
            const mentionedUsers = new Set();
            while ((match = mentionRegex.exec(comment.text)) !== null) {
                mentionedUsers.add(match[1]);
            }

            if (mentionedUsers.size > 0 && roomsUsers[roomId]) {
                const roomUserEntries = Object.entries(roomsUsers[roomId]);
                mentionedUsers.forEach(username => {
                    const foundUser = roomUserEntries.find(([id, user]) => user.name === username);
                    if (foundUser) {
                        const [socketId, _] = foundUser;
                        io.to(socketId).emit('mention-notification', {
                            commentId: comment.commentId,
                            author: comment.author,
                            text: comment.text
                        });
                    }
                });
            }

        } catch (err) {
            console.error('Error adding comment:', err);
        }
    });

    socket.on('edit-comment', async ({ roomId, commentId, newText }) => {
        try {
            await Room.findOneAndUpdate(
                { roomId, 'comments.commentId': commentId },
                { $set: { 'comments.$.text': newText } }
            );
            socket.to(roomId).emit('room-remote-data-refetch');
        } catch (err) {
            console.error('Error editing comment:', err);
        }
    });

    socket.on('delete-comment', async ({ roomId, commentId }) => {
        try {
            await Room.findOneAndUpdate(
                { roomId },
                { $pull: { comments: { commentId } } }
            );
            socket.to(roomId).emit('room-remote-data-refetch');
        } catch (err) {
            console.error('Error deleting comment:', err);
        }
    });

    socket.on('cursor-update', ({ roomId, editorId, cursor, user }) => {
        // user: { name, color }
        socket.to(roomId).emit('remote-cursor-update', { editorId, cursor, user, socketId: socket.id });
    });

    socket.on('typing-update', ({ roomId, user, isTyping }) => {
        socket.to(roomId).emit('remote-typing-update', { user, isTyping, socketId: socket.id });
    });

    socket.on('disconnect', () => {
        // Find which room this user was in
        for (const roomId in roomsUsers) {
            if (roomsUsers[roomId][socket.id]) {
                delete roomsUsers[roomId][socket.id];
                io.to(roomId).emit('collaborators-update', Object.values(roomsUsers[roomId]));
                if (Object.keys(roomsUsers[roomId]).length === 0) delete roomsUsers[roomId];
                break;
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
