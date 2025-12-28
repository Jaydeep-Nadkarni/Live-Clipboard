const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { v4: uuidv4 } = require('uuid');

// Check if room exists
router.get('/check/:roomId', async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId });
        res.json({ exists: !!room });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get room data
router.get('/data/:roomId', async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId });
        if (!room) return res.status(404).json({ message: 'Room not found' });

        // Ensure legacy content is handled
        room.editors = room.editors.map(ed => ({
            ...ed.toObject ? ed.toObject() : ed,
            content: ed.content || ''
        }));

        res.json(room);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new room
router.post('/create', async (req, res) => {
    const { roomId } = req.body;

    if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
    }

    try {
        console.log('Creating room with ID:', roomId);
        const existingRoom = await Room.findOne({ roomId });
        if (existingRoom) {
            console.log('Room ID already exists:', roomId);
            return res.status(400).json({ message: 'Room ID already exists' });
        }

        const newRoom = new Room({
            roomId,
            editors: [{
                editorId: uuidv4(),
                name: 'Main Editor',
                content: ''
            }],
            whiteboard: [],
            media: [],
            totalMediaSize: 0
        });

        await newRoom.save();
        console.log('Room created successfully:', roomId);
        res.status(201).json(newRoom);
    } catch (err) {
        console.error('Error in /create route:', err);
        res.status(500).json({ message: 'Internal Server Error', detail: err.message });
    }
});

// Add editor to room
router.post('/add-editor/:roomId', async (req, res) => {
    const { name } = req.body;
    try {
        const room = await Room.findOneAndUpdate(
            { roomId: req.params.roomId },
            {
                $push: {
                    editors: {
                        editorId: uuidv4(),
                        name: name || 'Untitled Editor',
                        content: null
                    }
                }
            },
            { new: true }
        );
        res.json(room);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
