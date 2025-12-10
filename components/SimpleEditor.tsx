
import React, { useEffect, useRef } from 'react';
import { 
    Bold, Italic, Underline, Strikethrough, 
    List, ListOrdered, 
    Undo, Redo, 
    Heading1, Heading2, Heading3, Heading4, 
    AlignLeft, AlignCenter, AlignRight, AlignJustify, 
    Link as LinkIcon, Palette, 
    Quote, Minus, Eraser, Type
} from 'lucide-react';

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
             // Only update if value is significantly different to prevent cursor jumping
             // or if editor is empty/default
             if (value === '' || editorRef.current.innerHTML === '<br>' || !editorRef.current.innerHTML) {
                 editorRef.current.innerHTML = value;
             }
        }
    }, [value]);

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
        const color = prompt('Nhập mã màu (VD: #d97706, red, yellow):', '#d97706');
        if (color) execCmd('foreColor', color);
    };

    const handleFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const size = e.target.value;
        if(size) execCmd('fontSize', size);
        // Reset select to default visual state
        e.target.value = ""; 
    };

    // Button Component for consistency
    const ToolbarBtn = ({ onClick, icon: Icon, title, active = false }: any) => (
        <button 
            type="button" 
            onClick={onClick} 
            className={`p-1.5 rounded transition-colors ${active ? 'bg-primary text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            title={title}
        >
            <Icon size={16}/>
        </button>
    );

    return (
        <div className="space-y-2">
            {label && <label className="text-sm font-medium text-slate-400">{label}</label>}
            <div className="bg-dark border border-white/10 rounded-lg overflow-hidden focus-within:border-primary transition-colors">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 bg-white/5 border-b border-white/10">
                    
                    {/* History */}
                    <div className="flex items-center gap-0.5">
                        <ToolbarBtn onClick={() => execCmd('undo')} icon={Undo} title="Hoàn tác" />
                        <ToolbarBtn onClick={() => execCmd('redo')} icon={Redo} title="Làm lại" />
                    </div>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    {/* Headings */}
                    <div className="flex items-center gap-0.5">
                        <ToolbarBtn onClick={() => execCmd('formatBlock', 'H2')} icon={Heading1} title="Tiêu đề lớn (H2)" />
                        <ToolbarBtn onClick={() => execCmd('formatBlock', 'H3')} icon={Heading2} title="Tiêu đề vừa (H3)" />
                        <ToolbarBtn onClick={() => execCmd('formatBlock', 'H4')} icon={Heading3} title="Tiêu đề nhỏ (H4)" />
                    </div>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    {/* Font Size & Color */}
                    <div className="flex items-center gap-0.5">
                        <div className="relative group mr-1">
                            <Type size={16} className="absolute left-2 top-1.5 text-slate-400 pointer-events-none group-hover:text-white" />
                            <select 
                                onChange={handleFontSize}
                                className="w-24 bg-transparent text-slate-400 text-xs py-1.5 pl-7 border border-white/10 rounded hover:bg-white/10 hover:text-white focus:bg-dark focus:text-white cursor-pointer appearance-none outline-none"
                                title="Cỡ chữ"
                                defaultValue=""
                            >
                                <option value="" disabled>Cỡ chữ</option>
                                <option value="1">Rất nhỏ</option>
                                <option value="2">Nhỏ</option>
                                <option value="3">Bình thường</option>
                                <option value="4">Vừa</option>
                                <option value="5">Lớn</option>
                                <option value="6">Rất lớn</option>
                                <option value="7">Khổng lồ</option>
                            </select>
                        </div>
                        <ToolbarBtn onClick={handleColor} icon={Palette} title="Màu chữ" />
                        <ToolbarBtn onClick={() => execCmd('removeFormat')} icon={Eraser} title="Xóa định dạng" />
                    </div>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    {/* Text Style */}
                    <div className="flex items-center gap-0.5">
                        <ToolbarBtn onClick={() => execCmd('bold')} icon={Bold} title="In đậm" />
                        <ToolbarBtn onClick={() => execCmd('italic')} icon={Italic} title="In nghiêng" />
                        <ToolbarBtn onClick={() => execCmd('underline')} icon={Underline} title="Gạch chân" />
                        <ToolbarBtn onClick={() => execCmd('strikeThrough')} icon={Strikethrough} title="Gạch ngang" />
                    </div>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    {/* Alignment */}
                    <div className="flex items-center gap-0.5">
                        <ToolbarBtn onClick={() => execCmd('justifyLeft')} icon={AlignLeft} title="Căn trái" />
                        <ToolbarBtn onClick={() => execCmd('justifyCenter')} icon={AlignCenter} title="Căn giữa" />
                        <ToolbarBtn onClick={() => execCmd('justifyRight')} icon={AlignRight} title="Căn phải" />
                        <ToolbarBtn onClick={() => execCmd('justifyFull')} icon={AlignJustify} title="Căn đều" />
                    </div>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>

                    {/* Structure */}
                    <div className="flex items-center gap-0.5">
                        <ToolbarBtn onClick={() => execCmd('insertUnorderedList')} icon={List} title="Danh sách chấm" />
                        <ToolbarBtn onClick={() => execCmd('insertOrderedList')} icon={ListOrdered} title="Danh sách số" />
                        <ToolbarBtn onClick={() => execCmd('formatBlock', 'blockquote')} icon={Quote} title="Trích dẫn" />
                        <ToolbarBtn onClick={() => execCmd('insertHorizontalRule')} icon={Minus} title="Đường kẻ ngang" />
                        <ToolbarBtn onClick={handleLink} icon={LinkIcon} title="Chèn Link" />
                    </div>
                </div>
                
                {/* Editable Area */}
                <div
                    ref={editorRef}
                    className="p-4 w-full outline-none text-slate-200 text-sm leading-relaxed overflow-y-auto prose prose-invert max-w-none custom-scrollbar"
                    contentEditable
                    onInput={handleInput}
                    style={{ minHeight: height, height: height }}
                    dangerouslySetInnerHTML={{ __html: value }} 
                />
            </div>
            <p className="text-[10px] text-slate-500 flex justify-between">
                <span>* Bôi đen văn bản để áp dụng định dạng.</span>
                <span>Hỗ trợ phím tắt: Ctrl+B, Ctrl+I, Ctrl+U</span>
            </p>
        </div>
    );
};

export default SimpleEditor;
