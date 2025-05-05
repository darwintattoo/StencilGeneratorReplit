import { Card } from "@/components/ui/card";
import { Loader2, Info, CheckCircle, AlertCircle, RefreshCw, Download } from "lucide-react";
import { StencilResponse, StencilError, StencilJobStatus } from "@/types";
import { useEffect, useState } from "react";
import { checkJobStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

interface ResponseDisplayProps {
  response: StencilResponse | null;
  error: StencilError | null;
  isLoading: boolean;
}

export function ResponseDisplay({ response, error, isLoading }: ResponseDisplayProps) {
  const [jobStatus, setJobStatus] = useState<StencilJobStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const { t } = useLanguage();
  
  // Poll for job status when we have a run_id
  useEffect(() => {
    let intervalId: number;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (5s interval * 60)

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
          clearInterval(intervalId);
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
    <div className="bg-[#1E1E1E] rounded-lg p-6 shadow-lg">
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
            <div className="py-4">
              <div className="flex justify-center items-center mb-2">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                <p className="text-gray-400">
                  Processing image...
                </p>
              </div>
              
              {/* Progress Bar - Only show when we have progress data */}
              {jobStatus?.progress !== undefined && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(jobStatus.progress * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
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

          {/* Job Status Error */}
          {statusError && (
            <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-md p-4 mb-4">
              <p className="text-[#F44336] text-sm">{statusError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 flex items-center"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          )}

          {/* Stencil Image Result */}
          {(jobStatus?.status === 'completed' || jobStatus?.status === 'success') && (
            <div className="mb-4">
              
              {/* Verificamos si existe jobStatus.outputs.image (que nuestro backend debería haber extraído) */}
              {jobStatus?.outputs?.image ? (
                <div className="bg-[#2D2D2D] p-2 rounded-md">
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
                  
                  {/* Botón de descarga centrado */}
                  <div className="flex justify-center mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center text-blue-500 hover:text-blue-400 px-4"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar Stencil
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#2D2D2D] p-4 rounded-md text-center">
                  <p className="text-yellow-500 mb-2">El trabajo se ha completado pero no se encontró la imagen del stencil.</p>
                  <p className="text-gray-400 text-sm">Consulta los detalles técnicos para más información.</p>
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
                Actualizar estado
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
                <p className="font-medium text-[#F44336]">Error en la solicitud</p>
                <p className="text-gray-400 text-sm">
                  {error.message || "Ocurrió un error al procesar tu solicitud"}
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm text-gray-400 mb-1">Detalles del error</h3>
            <pre className="bg-[#2D2D2D] rounded p-3 overflow-x-auto text-xs font-mono">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
