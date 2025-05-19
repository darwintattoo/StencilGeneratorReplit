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
          
          {/* Job Status Loading or Processing */}
          {!jobStatus?.outputs?.image && (
            <div className="py-4 bg-[#121212] rounded-lg border border-gray-800 shadow-inner progress-container">
              <div className="flex justify-center items-center mb-2">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                <p className="text-gray-400">
                  Processing image...
                </p>
              </div>
              
              {/* Progress Bar - Only show when we have progress data */}
              {jobStatus?.progress !== undefined && (
                <div className="mt-2 px-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(jobStatus.progress * 100)}%</span>
                  </div>
                  <div className="w-full bg-[#222222] rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                      style={{ width: `${jobStatus.progress * 100}%` }}
                    ></div>
                  </div>
                  {jobStatus?.live_status && (
                    <p className="text-xs text-gray-400 mt-1">
                      {jobStatus.live_status === "Executing CLIPVisionLoader" && "Analyzing contours..."}
                      {jobStatus.live_status === "Executing ComfyDeployOutputImage" && "Refining image..."}
                      {jobStatus.live_status === "Executing Image Input Switch" && "Applying final effects..."}
                      {jobStatus.live_status === "Executing ControlNetApply" && "Detecting edges..."}
                      {jobStatus.live_status === "Executing LineArt" && "Drawing lines..."}
                      {jobStatus.live_status === "Executing KSamplerAdvanced" && "Creating design..."}
                      {jobStatus.live_status === "Executing EmptyLatentImage" && "Preparing canvas..."}
                      {![
                        "Executing CLIPVisionLoader",
                        "Executing ComfyDeployOutputImage",
                        "Executing Image Input Switch",
                        "Executing ControlNetApply",
                        "Executing LineArt",
                        "Executing KSamplerAdvanced",
                        "Executing EmptyLatentImage"
                      ].includes(jobStatus.live_status) && "Processing stencil..."}
                    </p>
                  )}
                </div>
              )}
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
