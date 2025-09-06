import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import StencilEditor from '@/components/StencilEditor/StencilEditor';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import axios from 'axios';

export default function StencilEditorPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [stencilImage, setStencilImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Si no hay usuario autenticado, redirigir al login
    if (!user) {
      setLocation('/auth');
      return;
    }
    
    // Si estamos en modo de edición de un stencil guardado
    if (params.id) {
      loadSavedStencil(params.id);
    } else {
      // Comprobar si hay parámetros en la URL para el modo directo desde generación
      const searchParams = new URLSearchParams(window.location.search);
      const originalUrl = searchParams.get('original');
      const stencilUrl = searchParams.get('stencil');
      
      if (originalUrl && stencilUrl) {
        // Imprimimos los valores para depurar
        console.log('URL Imagen original:', originalUrl);
        console.log('URL Imagen stencil:', stencilUrl);
        
        // Convertir rutas @assets a URLs reales
        const convertAssetPath = (path: string) => {
          if (path.startsWith('@assets/')) {
            // Remover @assets/ y crear la URL correcta
            const assetPath = path.replace('@assets/', '');
            return new URL(`../assets/${assetPath}`, import.meta.url).href;
          }
          return path;
        };
        
        setOriginalImage(convertAssetPath(originalUrl));
        setStencilImage(convertAssetPath(stencilUrl));
        setIsLoading(false);
      } else {
        console.error('Parámetros faltantes:', { originalUrl, stencilUrl });
        setError('No se han proporcionado imágenes para editar');
        setIsLoading(false);
      }
    }
  }, [user, params, setLocation]);
  
  // Cargar un stencil guardado por ID
  const loadSavedStencil = async (id: string) => {
    try {
      setIsLoading(true);
      
      const response = await axios.get(`/api/stencils/${id}`);
      
      if (response.data) {
        setOriginalImage(response.data.originalImageUrl);
        setStencilImage(response.data.stencilImageUrl);
      } else {
        setError('Stencil no encontrado');
      }
    } catch (error) {
      console.error('Error al cargar el stencil:', error);
      setError('Error al cargar el stencil. Por favor, inténtalo de nuevo más tarde.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Guardar el stencil editado
  const handleSaveStencil = async (editedImageUrl: string) => {
    try {
      setIsLoading(true);
      
      // Si estamos editando un stencil existente
      if (params.id) {
        await axios.put(`/api/stencils/${params.id}`, {
          stencilImageUrl: editedImageUrl,
        });
      } else {
        // Guardar como nuevo stencil
        await axios.post('/api/stencils', {
          originalImageUrl: originalImage,
          stencilImageUrl: editedImageUrl,
          name: 'Stencil editado', // Nombre por defecto
        });
      }
      
      setLocation('/my-stencils');
    } catch (error) {
      console.error('Error al guardar el stencil:', error);
      alert('Error al guardar el stencil. Por favor, inténtalo de nuevo más tarde.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Si está cargando, mostrar un indicador
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
          <p className="text-xl">{t("loading") || "Cargando..."}</p>
        </div>
      </div>
    );
  }
  
  // Si hay un error, mostrarlo
  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-xl p-8 mb-8 text-center">
          <h2 className="text-xl font-bold mb-4">{t("error") || "Error"}</h2>
          <p className="mb-6">{error}</p>
          <Button onClick={() => setLocation('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back_to_home") || "Volver al inicio"}
          </Button>
        </div>
      </div>
    );
  }
  
  // Si tenemos las imágenes, mostrar el editor
  if (originalImage && stencilImage) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Editor de Stencil</h1>
            <Button variant="outline" onClick={() => setLocation('/')} className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("back") || "Volver"}
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
  
  // Estado de fallback que nunca debería ocurrir
  return (
    <div className="container mx-auto py-8">
      <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-xl p-8 mb-8 text-center">
        <h2 className="text-xl font-bold mb-4">{t("missing_images") || "Faltan imágenes"}</h2>
        <p className="mb-6">{t("no_images_to_edit") || "No hay imágenes disponibles para editar"}</p>
        <Button onClick={() => setLocation('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back_to_home") || "Volver al inicio"}
        </Button>
      </div>
    </div>
  );
}