import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-bg-primary/90 backdrop-blur-sm transition-colors duration-300"
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-bg-secondary border border-border-color shadow-2xl overflow-hidden transition-colors duration-300"
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary opacity-60">{title}</h3>
                            <button onClick={onClose} className="p-1 hover:bg-text-primary hover:text-bg-primary rounded-none transition-colors">
                                <X className="w-4 h-4 text-text-primary" />
                            </button>
                        </div>
                        <div className="p-6 text-text-primary">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Modal;
