
import React, { useEffect, useState, useRef } from 'react';
import { X, AlertTriangle, CheckCircle, HelpCircle, Info } from 'lucide-react';

export type ModalType = 'alert' | 'confirm' | 'prompt' | 'danger';

interface AppModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: (inputValue?: string) => void;
    title?: string;
    message?: React.ReactNode;
    type?: ModalType;
    confirmText?: string;
    cancelText?: string;
    defaultValue?: string; // For prompt
    placeholder?: string; // For prompt
}

const AppModal: React.FC<AppModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Thông báo',
    message,
    type = 'alert',
    confirmText = 'Đồng ý',
    cancelText = 'Hủy bỏ',
    defaultValue = '',
    placeholder = ''
}) => {
    const [inputValue, setInputValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setInputValue(defaultValue);
            // Focus input if prompt type
            if (type === 'prompt') {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    }, [isOpen, defaultValue, type]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm(type === 'prompt' ? inputValue : undefined);
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') onClose();
    };

    // Determine Icon and Colors based on type
    let Icon = Info;
    let iconColor = 'text-blue-500';
    let iconBg = 'bg-blue-500/10';
    let btnColor = 'bg-primary hover:bg-primary/90';

    if (type === 'danger') {
        Icon = AlertTriangle;
        iconColor = 'text-red-500';
        iconBg = 'bg-red-500/10';
        btnColor = 'bg-red-600 hover:bg-red-700';
        confirmText = confirmText === 'Đồng ý' ? 'Xóa' : confirmText;
    } else if (type === 'confirm') {
        Icon = HelpCircle;
        iconColor = 'text-yellow-500';
        iconBg = 'bg-yellow-500/10';
    } else if (type === 'prompt') {
        Icon = CheckCircle; // Or edit icon
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div 
                className="relative bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 scale-100"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/5">
                    <h3 className="font-bold text-white flex items-center gap-2">
                         <div className={`p-1.5 rounded-lg ${iconBg} ${iconColor}`}>
                             <Icon size={18} />
                         </div>
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="text-slate-300 text-sm leading-relaxed mb-4">
                        {message}
                    </div>

                    {type === 'prompt' && (
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 bg-white/5 border-t border-white/5">
                    {type !== 'alert' && (
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button 
                        onClick={handleConfirm}
                        className={`px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 ${btnColor}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppModal;
