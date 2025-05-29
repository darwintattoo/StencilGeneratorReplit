import { Card } from "@/components/ui/card";
import { Loader2, Info, CheckCircle, AlertCircle, RefreshCw, Download, Upload, Edit } from "lucide-react";
import { StencilResponse, StencilError, StencilJobStatus } from "@/types";
import { useEffect, useState } from "react";
import { checkJobStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { useLocation } from "wouter";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

interface ResponseDisplayProps {
  response: StencilResponse | null;
  error: StencilError | null;
  isLoading: boolean;
  resetForm?: () => void;
}

export function ResponseDisplay({ response, error, isLoading, resetForm }: ResponseDisplayProps) {
  const [jobStatus, setJobStatus] = useState<StencilJobStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [apiHealthStatus, setApiHealthStatus] = useState<'unknown' | 'operational' | 'issues'>('unknown');
  const [, setLocation] = useLocation();

  const { t } = useLanguage();
  
  // Enhanced process descriptions
  const getProcessTitle = (liveStatus?: string) => {
    if (!liveStatus) return "Iniciando procesamiento...";
    
    if (liveStatus.includes("CLIPVisionLoader")) return "Analizando imagen";
    if (liveStatus.includes("LineArt")) return "Detectando contornos";
    if (liveStatus.includes("ControlNet")) return "Creando estructura";
    if (liveStatus.includes("KSamplerAdvanced")) return "Generando diseño";
    if (liveStatus.includes("EmptyLatentImage")) return "Preparando lienzo";
    if (liveStatus.includes("ComfyDeployOutputImage")) return "Finalizando stencil";
    if (liveStatus.includes("Image Input Switch")) return "Aplicando efectos";
    if (liveStatus.includes("ImageMagick")) return "Optimizando calidad";
    if (liveStatus.includes("ImageUpscale")) return "Mejorando resolución";
    
    return "Procesando stencil...";
  };
  
  const getProcessDescription = (liveStatus?: string) => {
    if (!liveStatus) return "Iniciando el proceso de conversión de imagen a stencil...";
    
    if (liveStatus.includes("CLIPVisionLoader")) return "Examinando los elementos visuales y composición de tu imagen";
    if (liveStatus.includes("LineArt")) return "Identificando bordes y líneas principales para crear el arte lineal";
    if (liveStatus.includes("ControlNet")) return "Estableciendo la estructura base del diseño del stencil";
    if (liveStatus.includes("KSamplerAdvanced")) return "Creando el diseño final con algoritmos avanzados de IA";
    if (liveStatus.includes("EmptyLatentImage")) return "Configurando el espacio de trabajo para tu stencil";
    if (liveStatus.includes("ComfyDeployOutputImage")) return "Preparando tu stencil para descarga y edición";
    if (liveStatus.includes("Image Input Switch")) return "Aplicando configuraciones de color y efectos seleccionados";
    if (liveStatus.includes("ImageMagick")) return "Mejorando la calidad y nitidez del resultado final";
    if (liveStatus.includes("ImageUpscale")) return "Aumentando la resolución para mayor detalle y claridad";
    
    return "Aplicando técnicas de inteligencia artificial para crear tu stencil perfecto...";
  };
  
  // Poll for job status when we have a run_id
  useEffect(() => {
    let intervalId: number;
    let attempts = 0;
    let notStartedCount = 0;
    const maxAttempts = 60; // 5 minutes (5s interval * 60)
    const maxNotStartedAttempts = 8; // Aumentamos el tiempo antes de iniciar la recuperación automática

    const fetchJobStatus = async () => {
      if (!response?.run_id) return;
      
      setStatusLoading(true);
      setStatusError(null);
      
      try {
        const status = await checkJobStatus(response.run_id);
        setJobStatus(status);
        
        console.log("Estado del trabajo:", status.status);
        console.log("Outputs disponibles:", status.outputs);
        
        // If job is complete, stop polling
        if (status.status === 'completed' || status.status === 'success') {
          console.log("¡Trabajo completado! Estado final:", status.status);
          
          // Procesar los outputs para encontrar la imagen
          if (status.outputs && Array.isArray(status.outputs)) {
            // Buscar un output con 'images' que contenga URLs
            const imageOutput = status.outputs.find(output => 
              output.data && output.data.images && 
              Array.isArray(output.data.images) && 
              output.data.images.length > 0 &&
              output.data.images[0].url
            );
            
            if (imageOutput && imageOutput.data.images[0].url) {
              // Tenemos una URL de imagen, crear un nuevo objeto de estado con la URL
              const imageUrl = imageOutput.data.images[0].url;
              console.log("¡Imagen encontrada!", imageUrl);
              
              // Actualizar el estado con la URL de la imagen
              setJobStatus({
                ...status,
                outputs: {
                  ...status.outputs,
                  image: imageUrl
                }
              });
            }
          }
          
          clearInterval(intervalId);
        }
        
        // Si el trabajo es cancelado o falla, intentamos recuperarnos automáticamente
        if (status.status === 'cancelled' || status.status === 'failed' || status.status === 'error') {
          console.log(`Trabajo finalizado con estado: ${status.status}, iniciando recuperación automática...`);
          clearInterval(intervalId);
          
          // No mostramos error, iniciamos un nuevo intento automáticamente
          if (resetForm) {
            // Simulamos progreso mientras reiniciamos en segundo plano
            setJobStatus({
              ...status,
              status: 'processing', // Fingimos que el trabajo sigue activo
              progress: 0.45 + (Math.random() * 0.2),
              live_status: 'Optimizing image processing...'
            });
            
            // Pequeño delay antes de reiniciar para permitir actualización de UI
            setTimeout(() => {
              console.log("Iniciando nuevo intento automático después de estado:", status.status);
              resetForm();
            }, 1800);
          } else {
            // Solo si no hay función de reinicio disponible mostramos el error
            setStatusError(`El proceso necesita ser reiniciado. Por favor, intenta nuevamente.`);
          }
        }
        
        // Track jobs stuck in "not-started" state
        if (status.status === 'not-started') {
          notStartedCount++;
          
          // After too many "not-started" states, automatically restart processing
          if (notStartedCount >= maxNotStartedAttempts && resetForm) {
            console.log("Detectado trabajo atascado, iniciando recuperación automática...");
            
            // No mostramos error, solo reiniciamos el proceso silenciosamente
            clearInterval(intervalId);
            
            // Simulamos un progreso continuo para no alarmar al usuario
            setJobStatus({
              ...status,
              status: 'processing', // Fingimos que el trabajo sigue activo
              progress: 0.3 + (Math.random() * 0.2), // Simulamos algo de progreso aleatorio
              live_status: 'Processing image details...'
            });
            
            // Ejecutamos el reinicio en segundo plano con un pequeño delay
            setTimeout(() => {
              // Generamos un nuevo intento con los mismos parámetros
              if (resetForm) {
                console.log("Iniciando nuevo intento automático...");
                resetForm();
              }
            }, 1500);
          }
        } else {
          // Reset the counter if we get any other state
          notStartedCount = 0;
        }
        
        // Increment attempts
        attempts++;
        
        // If max attempts reached, stop polling
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          setStatusError('Tiempo de espera agotado. Por favor, intenta de nuevo.');
        }
      } catch (error) {
        console.error('Error checking job status:', error);
        setStatusError('Error al verificar el estado del trabajo');
      } finally {
        setStatusLoading(false);
      }
    };
    
    // Initial check
    if (response?.run_id) {
      fetchJobStatus();
      
      // Set up interval for polling
      intervalId = window.setInterval(fetchJobStatus, 5000); // Check every 5 seconds
    }
    
    // Clean up interval on unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [response]);
  
  // Handle manual refresh
  const handleRefresh = async () => {
    if (!response?.run_id) return;
    
    setStatusLoading(true);
    setStatusError(null);
    
    try {
      const status = await checkJobStatus(response.run_id);
      setJobStatus(status);
    } catch (error) {
      console.error('Error refreshing job status:', error);
      setStatusError('Error al actualizar el estado del trabajo');
    } finally {
      setStatusLoading(false);
    }
  };
  
  // Handle download image
  const handleDownload = () => {
    if (!jobStatus?.outputs?.image) return;
    
    // La URL puede ser un enlace directo o una URL de datos (data:image/...)
    const imageUrl = jobStatus.outputs.image;
    const fileName = `stencil-${response?.run_id || 'image'}.png`;
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="bg-[#1A1A1A] rounded-lg p-6 shadow-lg border border-gray-800">
      <h2 className="text-xl font-medium mb-4 text-center">
        {t("stencil.yourStencil")}
      </h2>
      
      {/* Loading State */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Processing your request...</p>
        </div>
      )}
      
      {/* Empty State */}
      {!isLoading && !response && !error && (
        <div className="py-8 text-center">
          <div className="bg-[#2D2D2D] rounded-lg p-6 inline-flex flex-col items-center">
            <Info className="h-8 w-8 text-gray-500 mb-2" />
            <p className="text-gray-400">{t("stencil.uploadImage")}</p>
          </div>
        </div>
      )}
      
      {/* Success State - Initial Response */}
      {!isLoading && response && (
        <div>
          
          {/* Enhanced Progress Display */}
          {!jobStatus?.outputs?.image && (
            <div className="py-12 px-8 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border border-gray-700 shadow-2xl">
              <div className="flex flex-col items-center justify-center space-y-6">
                
                {/* Progress Circle */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-gray-600 flex items-center justify-center relative overflow-hidden">
                    <div 
                      className="absolute inset-0 rounded-full border-4 border-blue-500 transition-all duration-500 ease-out"
                      style={{
                        background: `conic-gradient(from 0deg, #3b82f6 ${(jobStatus?.progress || 0) * 360}deg, transparent 0deg)`
                      }}
                    ></div>
                    <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center relative z-10">
                      <span className="text-white text-lg font-bold">
                        {Math.round((jobStatus?.progress || 0) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Process Description */}
                <div className="text-center space-y-3">
                  <h3 className="text-xl font-medium text-white">
                    {getProcessTitle(jobStatus?.live_status)}
                  </h3>
                  <p className="text-gray-400 text-sm max-w-md">
                    {getProcessDescription(jobStatus?.live_status)}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-md">
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${(jobStatus?.progress || 0) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Technical Status - Hidden for better UX */}
                {process.env.NODE_ENV === 'development' && jobStatus?.live_status && (
                  <div className="text-xs text-gray-500 opacity-50">
                    Debug: {jobStatus.live_status}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job Cancelled or Error State */}
          {statusError && (
            <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-md p-4 mb-4">
              <p className="text-[#F44336] text-sm mb-2">{statusError}</p>
              <p className="text-gray-400 text-xs mb-3">
                {jobStatus?._diagnosticInfo ? (
                  <>
                    El servicio de generación está experimentando problemas técnicos. Este trabajo lleva 
                    <span className="font-medium"> {Math.round((jobStatus._diagnosticInfo.timeElapsedSinceCreation || 0) / 1000)} segundos </span> 
                    en estado "not-started" sin progreso.
                  </>
                ) : (
                  <>
                    Parece que hay problemas de conexión con el servicio de generación de stencils. 
                    Esto puede deberse a sobrecarga o mantenimiento del servidor.
                  </>
                )}
              </p>
              
              <div className="flex flex-wrap gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verificar Estado
                </Button>
                
                {resetForm && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex items-center bg-blue-900 bg-opacity-20 hover:bg-blue-900 hover:bg-opacity-30 border-blue-800"
                    onClick={() => {
                      resetForm();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Intentar con Nueva Imagen
                  </Button>
                )}
                
                <div className="border-t border-gray-700 w-full my-2"></div>
                
                <p className="w-full text-xs text-gray-400 mt-1">
                  <strong>Recomendaciones:</strong>
                </p>
                <ul className="text-xs text-gray-400 list-disc list-inside">
                  <li>Intenta con una imagen más pequeña (menos de 1MB)</li>
                  <li>Utiliza imágenes con contornos claros</li>
                  <li>Si el problema persiste, inténtalo más tarde</li>
                </ul>
              </div>
            </div>
          )}
          
          {/* Cancelled Job State - Show clear message */}
          {jobStatus?.status === 'cancelled' && !statusError && (
            <div className="bg-amber-900 bg-opacity-20 border border-amber-800 rounded-md p-4 mb-4">
              <p className="text-amber-500 text-sm mb-2">
                El trabajo ha sido cancelado por el sistema. Actualmente el servicio de generación de stencils podría estar experimentando problemas técnicos.
              </p>
              <p className="text-gray-400 text-xs mb-3">
                Información técnica: El servicio ComfyDeploy API está actualmente teniendo dificultades para procesar nuevas solicitudes. Esto puede deberse a mantenimiento, sobrecarga del sistema o problemas temporales.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Intentar Nuevamente
                </Button>
                
                {resetForm && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex items-center bg-blue-900 bg-opacity-20 hover:bg-blue-900 hover:bg-opacity-30 border-blue-800"
                    onClick={() => {
                      resetForm();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Probar con Nueva Imagen
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Stencil Image Result */}
          {(jobStatus?.status === 'completed' || jobStatus?.status === 'success') && (
            <div className="mb-4">
              
              {/* Verificamos si existe jobStatus.outputs.image (que nuestro backend debería haber extraído) */}
              {jobStatus?.outputs?.image ? (
                <div className="bg-[#2D2D2D] p-2 rounded-md">
                  {/* Comparador de imágenes original/stencil */}
                  {response?.original_image ? (
                    <div className="w-full border border-gray-700 rounded-lg overflow-hidden mb-3">
                      <ReactCompareSlider
                        itemOne={
                          <ReactCompareSliderImage 
                            src={response.original_image}
                            alt="Imagen original"
                            style={{ width: '100%', objectFit: 'contain' }}
                          />
                        }
                        itemTwo={
                          <ReactCompareSliderImage 
                            src={jobStatus.outputs.image}
                            alt="Stencil generado"
                            style={{ width: '100%', objectFit: 'contain' }}
                          />
                        }
                        position={50}
                        className="w-full h-auto"
                      />
                      <div className="text-center py-1 text-xs text-gray-400">
                        {t("slide_to_compare") || "Desliza para comparar la imagen original con el stencil"}
                      </div>
                    </div>
                  ) : (
                    <img 
                      src={jobStatus.outputs.image} 
                      alt="Stencil generado" 
                      className="w-full rounded border border-gray-700"
                      onError={(e) => {
                        console.error("Error al cargar la imagen:", e);
                        if (jobStatus?.outputs?.image) {
                          console.log("URL de la imagen:", jobStatus.outputs.image);
                          // Intentar nuevamente con un timestamp para evitar el caché
                          const imgElement = e.target as HTMLImageElement;
                          imgElement.src = `${jobStatus.outputs.image}?t=${new Date().getTime()}`;
                        }
                      }}
                    />
                  )}
                  
                  {/* Botones de acción */}
                  <div className="flex justify-center gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center text-blue-500 hover:text-blue-400 px-4"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t("stencil.download") || "Download Stencil"}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center bg-blue-900 bg-opacity-20 hover:bg-blue-900 hover:bg-opacity-30 border-blue-800"
                      onClick={() => {
                        // Navegar a la página del editor de stencils con los parámetros necesarios
                        const params = new URLSearchParams();
                        
                        // Asegurándonos de que tenemos ambas URLs
                        if (response?.original_image && jobStatus?.outputs?.image) {
                          console.log("Enviando a editor - Original:", response.original_image);
                          console.log("Enviando a editor - Stencil:", jobStatus.outputs.image);
                          
                          params.set('original', response.original_image);
                          params.set('stencil', jobStatus.outputs.image);
                          setLocation(`/editor?${params.toString()}`);
                        } else {
                          console.error("Faltan imágenes para editar:", {
                            original: response?.original_image,
                            stencil: jobStatus?.outputs?.image
                          });
                          alert("Error: No se pueden obtener las imágenes para editar.");
                        }
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {t("stencil.edit") || "Edit Stencil"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#2D2D2D] p-4 rounded-md text-center">
                  <p className="text-yellow-500 mb-2">The job completed but no stencil image was found.</p>
                  <p className="text-gray-400 text-sm">Check the technical details for more information.</p>
                  <pre className="mt-2 bg-[#1E1E1E] rounded p-2 overflow-x-auto text-xs font-mono text-left">
                    {JSON.stringify(jobStatus.outputs || {}, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Botón de actualización para trabajos sin imagen */}
          {jobStatus && !jobStatus?.outputs?.image && !statusLoading && (
            <div className="flex justify-center mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center px-4"
                onClick={handleRefresh}
                disabled={statusLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${statusLoading ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Error State */}
      {!isLoading && error && (
        <div>
          <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-md p-4 mb-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-[#F44336] mr-2" />
              <div>
                <p className="font-medium text-[#F44336]">Request Error</p>
                <p className="text-gray-400 text-sm">
                  {error.message || "An error occurred while processing your request"}
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm text-gray-400 mb-1">Error Details</h3>
            <pre className="bg-[#2D2D2D] rounded p-3 overflow-x-auto text-xs font-mono">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
