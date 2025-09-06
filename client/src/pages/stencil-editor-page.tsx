import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import StencilEditor from '@/components/StencilEditor/StencilEditor';
import { useRef } from 'react';

export default function StencilEditorPage() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [stencilImage, setStencilImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Para demo, usar imágenes por defecto si existen
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const originalUrl = searchParams.get('original');
    const stencilUrl = searchParams.get('stencil');
    
    if (originalUrl && stencilUrl) {
      const convertAssetPath = (path: string) => {
        if (path.startsWith('@assets/')) {
          const assetPath = path.replace('@assets/', '');
          return new URL(`../assets/${assetPath}`, import.meta.url).href;
        }
        return path;
      };
      
      setOriginalImage(convertAssetPath(originalUrl));
      setStencilImage(convertAssetPath(stencilUrl));
    }
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setOriginalImage(result);
        setStencilImage(result); // Por ahora usar la misma imagen
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveStencil = async (editedImageUrl: string) => {
    // Crear enlace de descarga
    const link = document.createElement('a');
    link.href = editedImageUrl;
    link.download = 'stencil-edited.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetEditor = () => {
    setOriginalImage(null);
    setStencilImage(null);
    setError(null);
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="container mx-auto py-8">
          <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-xl p-8 mb-8 text-center">
            <h2 className="text-xl font-bold mb-4 text-white">Error</h2>
            <p className="mb-6 text-gray-300">{error}</p>
            <Button onClick={resetEditor} className="bg-blue-600 hover:bg-blue-700">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Si no hay imágenes, mostrar pantalla de carga de archivos
  if (!originalImage || !stencilImage) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Stencil Editor</h1>
          </div>
          
          <div className="max-w-md mx-auto mt-32">
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-8 text-center">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-4">Upload Image</h3>
              <p className="text-gray-400 mb-6">Select an image to start creating your stencil</p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 w-full"
              >
                Choose Image
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Si tenemos las imágenes, mostrar el editor
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Stencil Editor</h1>
          <Button 
            variant="outline" 
            onClick={resetEditor} 
            className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            New Image
          </Button>
        </div>
        
        <StencilEditor
          originalImage={originalImage}
          stencilImage={stencilImage}
          onSave={handleSaveStencil}
        />
      </div>
    </div>
  );
}