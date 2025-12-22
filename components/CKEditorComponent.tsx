import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    DecoupledEditor: any;
  }
}

interface CKEditorComponentProps {
  value: string;
  onChange: (value: string) => void;
}

const CKEditorComponent: React.FC<CKEditorComponentProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<any>(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    const SCRIPT_ID = 'ckeditor-script';
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;

    const initializeEditor = () => {
      if (window.DecoupledEditor && editorRef.current && toolbarRef.current && !editorInstance.current) {
        window.DecoupledEditor.create(editorRef.current, {
          toolbar: {
            items: [
                'heading', '|',
                'fontSize', 'fontFamily', '|',
                'fontColor', 'fontBackgroundColor', '|',
                'bold', 'italic', 'underline', 'strikethrough', '|',
                'alignment', '|',
                'numberedList', 'bulletedList', '|',
                'outdent', 'indent', '|',
                'link', 'blockQuote', 'insertTable', 'horizontalLine', '|',
                'undo', 'redo'
            ]
          }
        })
        .then((editor: any) => {
          editorInstance.current = editor;

          // Append toolbar to the dedicated container
          toolbarRef.current.innerHTML = ''; // Clear previous toolbar if any
          toolbarRef.current.appendChild(editor.ui.view.toolbar.element);

          editor.setData(value);
          editor.model.document.on('change:data', () => {
            const data = editor.getData();
            if (onChange) {
               onChange(data);
            }
          });
        })
        .catch((error: any) => {
          console.error('There was a problem initializing the editor.', error);
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://cdn.ckeditor.com/ckeditor5/41.4.2/decoupled-document/ckeditor.js'; // Use Decoupled build
      script.async = true;
      script.onload = () => {
        isLoaded.current = true;
        initializeEditor();
      };
      document.body.appendChild(script);
    } else if (isLoaded.current || script.getAttribute('data-loaded')) {
        initializeEditor();
    } else {
        script.addEventListener('load', initializeEditor);
    }

    return () => {
      if (editorInstance.current) {
        editorInstance.current.destroy();
        editorInstance.current = null;
      }
      if (script) {
          script.removeEventListener('load', initializeEditor);
      }
      if (toolbarRef.current) {
        toolbarRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
      if (editorInstance.current && editorInstance.current.getData() !== value) {
          editorInstance.current.setData(value);
      }
  }, [value]);

  return (
    <div className="bg-dark border border-white/10 rounded-lg overflow-hidden focus-within:border-primary transition-colors ck-editor-container">
        <div ref={toolbarRef} className="ck-toolbar-container" />
        <div ref={editorRef} className="ck-editor-content" />
    </div>
  );
};

export default CKEditorComponent;