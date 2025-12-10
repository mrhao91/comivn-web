
import React, { useEffect, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Undo, Redo, Heading1, Heading2, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Palette } from 'lucide-react';

interface SimpleEditorProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    height?: string;
}

const SimpleEditor: React.FC<SimpleEditorProps> = ({ value, onChange, label, height = "200px" }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
             if (value === '' || editorRef.current.innerHTML === '<br>') {
                 editorRef.current.innerHTML = value;
             }
        }
    }, []);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) editorRef.current.focus();
    };

    const handleLink = () => {
        const url = prompt('Nhập đường dẫn URL:');
        if (url) execCmd('createLink', url);
    };

    const handleColor = () => {
        // Simple preset colors compatible with Earth theme
        const color = prompt('Nhập mã màu (VD: #d97706, red, yellow):', '#d97706');
        if (color) execCmd('foreColor', color);
    };

    return (
        <div className="space-y-2">
            {label && <label className="text-sm font-medium text-slate-400">{label}</label>}
            <div className="bg-dark border border-white/10 rounded-lg overflow-hidden focus-within:border-primary transition-colors">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 bg-white/5 border-b border-white/10">
                    <button type="button" onClick={() => execCmd('formatBlock', 'H2')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Tiêu đề lớn"><Heading1 size={16}/></button>
                    <button type="button" onClick={() => execCmd('formatBlock', 'H3')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Tiêu đề nhỏ"><Heading2 size={16}/></button>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>
                    
                    <button type="button" onClick={() => execCmd('bold')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="In đậm"><Bold size={16}/></button>
                    <button type="button" onClick={() => execCmd('italic')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="In nghiêng"><Italic size={16}/></button>
                    <button type="button" onClick={handleColor} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Màu chữ"><Palette size={16}/></button>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    <button type="button" onClick={() => execCmd('justifyLeft')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Căn trái"><AlignLeft size={16}/></button>
                    <button type="button" onClick={() => execCmd('justifyCenter')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Căn giữa"><AlignCenter size={16}/></button>
                    <button type="button" onClick={() => execCmd('justifyRight')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Căn phải"><AlignRight size={16}/></button>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    <button type="button" onClick={() => execCmd('insertUnorderedList')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Danh sách"><List size={16}/></button>
                    <button type="button" onClick={() => execCmd('insertOrderedList')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Danh sách số"><ListOrdered size={16}/></button>
                    <button type="button" onClick={handleLink} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Chèn Link"><LinkIcon size={16}/></button>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    <button type="button" onClick={() => execCmd('undo')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Hoàn tác"><Undo size={16}/></button>
                    <button type="button" onClick={() => execCmd('redo')} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded" title="Làm lại"><Redo size={16}/></button>
                </div>
                
                {/* Editable Area */}
                <div
                    ref={editorRef}
                    className="p-4 w-full outline-none text-slate-200 text-sm leading-relaxed overflow-y-auto prose prose-invert max-w-none"
                    contentEditable
                    onInput={handleInput}
                    style={{ minHeight: height, height: height }}
                    dangerouslySetInnerHTML={{ __html: value }} 
                />
            </div>
            <p className="text-[10px] text-slate-500">* Bôi đen văn bản để áp dụng định dạng.</p>
        </div>
    );
};

export default SimpleEditor;
