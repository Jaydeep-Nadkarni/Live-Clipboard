import React, { useRef, useEffect, useState } from 'react';

const Whiteboard = ({ socket, roomId, actions, onAction }) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#6366f1');
    const [lineWidth, setLineWidth] = useState(3);
    const lastPoint = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const resize = () => {
            canvas.width = canvas.offsetWidth * 2;
            canvas.height = canvas.offsetHeight * 2;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            contextRef.current = ctx;
            // Redraw everything on resize
            actions.forEach(action => drawAction(action, ctx));
        };

        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [actions]);

    useEffect(() => {
        if (!socket) return;
        const handleRemoteAction = (action) => {
            drawAction(action, contextRef.current);
        };
        socket.on('whiteboard-remote-action', handleRemoteAction);
        return () => socket.off('whiteboard-remote-action', handleRemoteAction);
    }, [socket]);

    const drawAction = (action, ctx) => {
        if (!ctx) return;
        const { type, data } = action;

        if (type === 'line') {
            ctx.beginPath();
            ctx.strokeStyle = data.color;
            ctx.lineWidth = data.width;
            ctx.moveTo(data.start.x, data.start.y);
            ctx.lineTo(data.end.x, data.end.y);
            ctx.stroke();
            ctx.closePath();
        } else if (type === 'clear') {
            const canvas = canvasRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = nativeEvent;
        lastPoint.current = { x: offsetX, y: offsetY };
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing || !lastPoint.current) return;
        const { offsetX, offsetY } = nativeEvent;
        const currentPoint = { x: offsetX, y: offsetY };

        const action = {
            type: 'line',
            data: {
                start: lastPoint.current,
                end: currentPoint,
                color,
                width: lineWidth
            }
        };

        drawAction(action, contextRef.current);
        onAction(action);
        socket.emit('whiteboard-action', { roomId, action });

        lastPoint.current = currentPoint;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        lastPoint.current = null;
    };

    const clearBoard = () => {
        const action = { type: 'clear', data: {} };
        drawAction(action);
        onAction(action);
        socket.emit('whiteboard-action', { roomId, action });
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
                <div className="flex items-center gap-4">
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                    />
                    <input
                        type="range"
                        min="1" max="20"
                        value={lineWidth}
                        onChange={(e) => setLineWidth(e.target.value)}
                        className="w-32 accent-indigo-500"
                    />
                </div>
                <button
                    onClick={clearBoard}
                    className="px-4 py-2 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 rounded-lg transition-all text-sm font-medium"
                >
                    Clear Board
                </button>
            </div>
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="flex-1 cursor-crosshair touch-none"
            />
        </div>
    );
};

export default Whiteboard;
