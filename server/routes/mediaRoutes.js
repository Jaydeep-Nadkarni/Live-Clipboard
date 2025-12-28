const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const Room = require('../models/Room');

const Media = require('../models/Media');

// Upload media to DB
router.post('/upload/:roomId', upload.single('media'), async (req, res) => {
    const { roomId } = req.params;
    const { type } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const room = await Room.findOne({ roomId });
        if (!room) return res.status(404).json({ message: 'Room not found' });

        if (room.totalMediaSize + req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: 'Media storage limit (5MB) reached' });
        }

        const mediaItem = new Media({
            roomId,
            name: req.file.originalname,
            type,
            data: req.file.buffer,
            contentType: req.file.mimetype,
            size: req.file.size
        });

        const savedMedia = await mediaItem.save();

        // Update room metadata
        room.media.push({
            type,
            url: `${process.env.VITE_API_URL || 'http://localhost:5000/api'}/media/view/${savedMedia._id}`,
            size: req.file.size,
            name: req.file.originalname
        });
        room.totalMediaSize += req.file.size;
        await room.save();

        res.json(room.media[room.media.length - 1]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// View/Stream media from DB
router.get('/view/:mediaId', async (req, res) => {
    try {
        const media = await Media.findById(req.params.mediaId);
        if (!media) return res.status(404).send('Not found');

        res.set('Content-Type', media.contentType);
        res.send(media.data);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;
