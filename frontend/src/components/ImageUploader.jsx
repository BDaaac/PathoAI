import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

export default function ImageUploader({ onFile, disabled }) {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);

  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    const f = accepted[0];
    setFile(f);
    setPreview(URL.createObjectURL(f));
    onFile(f);
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'] },
    maxFiles: 1,
    disabled,
  });

  const clear = (e) => {
    e.stopPropagation();
    setPreview(null);
    setFile(null);
    onFile(null);
  };

  return (
    <div
      {...getRootProps()}
      className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 bg-white'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="Preview" className="w-full h-72 object-contain rounded-xl" />
          {!disabled && (
            <button
              onClick={clear}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X size={14} />
            </button>
          )}
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {file?.name}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            {isDragActive ? (
              <ImageIcon size={28} className="text-blue-500" />
            ) : (
              <Upload size={28} className="text-blue-500" />
            )}
          </div>
          <p className="text-slate-700 font-medium">
            {isDragActive ? 'Отпустите файл' : 'Перетащите изображение или нажмите'}
          </p>
          <p className="text-slate-400 text-sm mt-1">PNG, JPG, TIFF до 20 МБ</p>
        </div>
      )}
    </div>
  );
}
