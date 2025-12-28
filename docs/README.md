# Live Room-Based Clipboard Documentation

## Overview
A temporary, real-time collaborative workspace.

## Folder Structure
- `client/`: React + Vite + Tailwind CSS frontend.
- `server/`: Node.js + Express + MongoDB backend.
- `docs/`: Documentation.

## Key Features
1. **Real-time Collaboration**: Using Socket.io for editors and whiteboard.
2. **Multi-Editor Support**: Create multiple named editors per room.
3. **Whiteboard**: Shared drawing canvas.
4. **Media Support**: Image paste and audio upload (5MB per room).
5. **24h Persistence**: Rooms are automatically deleted after 24 hours.

## Database Schema
Refer to `server/models/Room.js` for the MongoDB schema.
TTL is implemented on the `createdAt` field.
