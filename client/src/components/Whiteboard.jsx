import React, { useRef, useEffect, useState } from 'react';

const Whiteboard = ({ socket, roomId, actions, onAction }) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#FFFFFF'); // Default white for dark mode
    const [lineWidth, setLineWidth] = useState(3);
    const lastPoint = useRef(null);

    useEffect(() => {
        // Set initial color based on theme if possible, but manual override is safer for canvas
        const computedStyle = getComputedStyle(document.body);
        const textColor = computedStyle.getPropertyValue('--text-primary').trim();
        setColor(textColor || '#FFFFFF');
    }, []);

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
        <div className="flex flex-col h-full bg-bg-secondary rounded-none border border-border-color overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border-color bg-bg-primary">
                <div className="flex items-center gap-4">
                    {/* Strict B&W Palette */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setColor('#FFFFFF')}
                            className={`w-6 h-6 rounded-none border border-white ${color === '#FFFFFF' ? 'bg-white' : 'bg-black'}`}
                            title="White"
                        />
                        <button
                            onClick={() => setColor('#000000')}
                            className={`w-6 h-6 rounded-none border border-white ${color === '#000000' ? 'bg-white' : 'bg-black'}`}
                            title="Black"
                        />
                    </div>

                    <input
                        type="range"
                        min="1" max="20"
                        value={lineWidth}
                        onChange={(e) => setLineWidth(e.target.value)}
                        className="w-32 accent-text-primary"
                    />
                </div>
                <button
                    onClick={clearBoard}
                    className="px-4 py-2 bg-bg-secondary border border-border-color hover:bg-text-primary hover:text-bg-primary text-text-primary uppercase text-xs font-bold tracking-widest transition-all"
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
