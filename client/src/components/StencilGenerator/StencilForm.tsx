import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { uploadImageForStencil } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload } from "lucide-react";
import { StencilResponse, StencilError } from "@/types";

interface StencilFormProps {
  setResponse: (response: StencilResponse | null) => void;
  setError: (error: StencilError | null) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}

export function StencilForm({ 
  setResponse, 
  setError,
  isLoading,
  setIsLoading
}: StencilFormProps) {
  // Establecer valores predeterminados exactamente como los espera la API
  const [lineColor, setLineColor] = useState("red");                        // "line_color"
  const [transparentBackground, setTransparentBackground] = useState(true); // "activar_transparencia"
  const [selectedFile, setSelectedFile] = useState<File | null>(null);      // "Darwin Enriquez"
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAdvancedOptionsOpen, setIsAdvancedOptionsOpen] = useState(false);
  const [aiModel, setAiModel] = useState("SDXL-Flash.safetensors");         // "AI Model"
  const [enhanceShadows, setEnhanceShadows] = useState(false);              // "iluminar sombras"
  const [selectedPreset, setSelectedPreset] = useState("LoraLineart/Darwinstencil3-000007.safetensors"); // "estilo de linea"
  
  const { toast } = useToast();
  const { t } = useLanguage();

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    }
  }, []);

  // Handle file selection from the input field
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileSelect(file);
    }
  };

  const handleFileSelect = (file: File) => {
    // Lista explícita de tipos MIME permitidos
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
    
    console.log("Tipo de archivo seleccionado:", file.type, "nombre:", file.name, "tamaño:", file.size);
    
    // Check if the file is an allowed image type
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t("form.error"),
        description: `${t("form.error_file_type")} (${file.type})`,
        variant: "destructive"
      });
      return;
    }
    
    // Verificar el tamaño del archivo (máximo 15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: t("form.error"),
        description: t("form.error_file_size"),
        variant: "destructive"
      });
      return;
    }
    
    // Update state with the selected file
    setSelectedFile(file);
    
    // Create a preview URL for the image
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form - a file must be provided
    if (!selectedFile) {
      toast({
        title: t("form.error"),
        description: t("form.error_no_file"),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setError(null);

    try {
      // Mostrar en consola los valores de los parámetros
      console.log("enhanceShadows value:", enhanceShadows);
      console.log("enhanceShadows type:", typeof enhanceShadows);
      console.log("aiModel:", aiModel);
      console.log("presetLora:", selectedPreset);
      
      // Usar la función de subida con el archivo seleccionado
      const response = await uploadImageForStencil({
        image: selectedFile,
        lineColor,
        transparentBackground,
        aiModel,
        enhanceShadows,
        presetLora: selectedPreset
      });
      
      setResponse(response);
      setError(null);
    } catch (err) {
      setResponse(null);
      setError(err as StencilError);
      
      toast({
        title: t("form.error"),
        description: (err as Error).message || t("form.error_generate"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0d0d0d] rounded-xl p-8 shadow-xl mb-8 border border-gray-800">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SECCIÓN: CARGA DE IMAGEN */}
        <div className="space-y-4 mb-4">
          <div className="border-b border-gray-800 pb-1 mb-2">
            <Label className="font-medium text-lg">{t("form.upload_label")}</Label>
          </div>
          
          {/* Drag & Drop Area */}
          <div 
            className={`border-2 border-dashed rounded-xl p-8 transition-colors ${isDragging ? 'border-blue-500 bg-blue-900 bg-opacity-10' : 'border-gray-700 hover:border-blue-400'}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              {imagePreview ? (
                // Image preview
                <div className="relative w-full">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="max-h-48 max-w-full mx-auto rounded-md object-contain" 
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                    aria-label="Remove image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ) : (
                // Upload prompt
                <>
                  <Upload className="h-16 w-16 text-blue-500" />
                  <p className="text-center text-gray-300 text-lg">{t("form.drag_drop")}</p>
                  <p className="text-sm text-gray-400 mt-1">{t("form.or_click")}</p>
                  <p className="text-xs text-gray-500 mt-1">{t("form.supported_formats")}</p>
                </>
              )}
              
              {/* Hidden file input */}
              <input
                type="file"
                id="fileInput"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              
              {/* Browse button */}
              {!imagePreview && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="mt-2" 
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  {t("form.browse_files")}
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* SECCIÓN: OPCIONES BÁSICAS - Los más usados primero */}
        <div className="border-t border-gray-800 pt-4 mt-6 mb-4">
          <div className="border-b border-gray-800 pb-1 mb-4">
            <h3 className="text-md font-medium text-gray-300">Opciones Básicas</h3>
          </div>
          
          {/* line_color - El parámetro más usado primero */}
          <div className="space-y-2 mb-4">
            <Label className="font-medium text-lg">line_color</Label>
            <div className="flex space-x-6 justify-center">
              {/* Black */}
              <div className="flex items-center">
                <input
                  type="radio"
                  id="color-black"
                  name="lineColor"
                  value="black"
                  checked={lineColor === "black"}
                  onChange={() => setLineColor("black")}
                  className="hidden peer"
                />
                <label
                  htmlFor="color-black"
                  className={`flex items-center justify-center w-12 h-12 rounded-full bg-black border-2 border-gray-700 cursor-pointer ${
                    lineColor === "black" ? "border-white ring-2 ring-[#ff0000]" : ""
                  }`}
                >
                  <span className="sr-only">Black</span>
                </label>
              </div>
              
              {/* Red */}
              <div className="flex items-center">
                <input
                  type="radio"
                  id="color-red"
                  name="lineColor"
                  value="red"
                  checked={lineColor === "red"}
                  onChange={() => setLineColor("red")}
                  className="hidden peer"
                />
                <label
                  htmlFor="color-red"
                  className={`flex items-center justify-center w-12 h-12 rounded-full bg-red-600 border-2 border-gray-700 cursor-pointer ${
                    lineColor === "red" ? "border-white ring-2 ring-[#ff0000]" : ""
                  }`}
                >
                  <span className="sr-only">Red</span>
                </label>
              </div>
              
              {/* Blue */}
              <div className="flex items-center">
                <input
                  type="radio"
                  id="color-blue"
                  name="lineColor"
                  value="blue"
                  checked={lineColor === "blue"}
                  onChange={() => setLineColor("blue")}
                  className="hidden peer"
                />
                <label
                  htmlFor="color-blue"
                  className={`flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 border-2 border-gray-700 cursor-pointer ${
                    lineColor === "blue" ? "border-white ring-2 ring-[#ff0000]" : ""
                  }`}
                >
                  <span className="sr-only">Blue</span>
                </label>
              </div>
            </div>
          </div>
          
          {/* activar_transparencia */}
          <div className="space-y-1 mb-4 p-3 bg-opacity-30 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <Label htmlFor="transparency" className="font-medium">Activar Fondo Transparente</Label>
              <div className="flex items-center">
                <span className="text-xs text-gray-400 mr-2">activar_transparencia</span>
                <Switch
                  id="transparency"
                  checked={transparentBackground}
                  onCheckedChange={setTransparentBackground}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>
            <p className="text-sm text-gray-400">{t("form.transparent_bg_help")}</p>
          </div>
          
          {/* iluminar sombras */}
          <div className="space-y-1 mb-4 p-3 bg-opacity-30 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <Label htmlFor="enhanceShadows" className="font-medium">{t("form.enhance_shadows")}</Label>
              <div className="flex items-center">
                <span className="text-xs text-gray-400 mr-2">iluminar sombras</span>
                <Switch
                  id="enhanceShadows"
                  checked={enhanceShadows}
                  onCheckedChange={setEnhanceShadows}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>
            <p className="text-sm text-gray-400">{t("form.enhance_shadows_help")}</p>
          </div>
        </div>
        
        {/* SECCIÓN: OPCIONES AVANZADAS (Desplegable) */}
        <div className="border-t border-gray-800 pt-4 mt-6 mb-4">
          <button 
            type="button"
            onClick={() => setIsAdvancedOptionsOpen(!isAdvancedOptionsOpen)}
            className="w-full flex items-center justify-between py-2 px-1 rounded-lg hover:bg-gray-800/30 transition-colors"
          >
            <h3 className="text-md font-medium text-gray-300">{t("form.advanced_options")}</h3>
            <div className={`transition-transform duration-200 ${isAdvancedOptionsOpen ? 'rotate-180' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </button>
          
          {isAdvancedOptionsOpen && (
            <div className="mt-4 pt-2 border-t border-gray-800/50 animate-in fade-in duration-200">
              {/* AI Model */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">{t("form.ai_model")}</Label>
                  <span className="text-sm text-blue-400">{aiModel === "SDXL-Flash.safetensors" ? "Model 1" : 
                    aiModel === "Lineart/dreamshaperXL_v21TurboDPMSDE.safetensors" ? "Model 2" : 
                    aiModel === "Lineart/aamXLAnimeMix_v10.safetensors" ? "Model 3" : "Model 4"}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAiModel("SDXL-Flash.safetensors")}
                    className={`p-3 rounded-lg text-center ${aiModel === "SDXL-Flash.safetensors" ? "bg-blue-600 text-white" : "bg-[#171717] border border-gray-700 hover:border-blue-500"}`}
                  >
                    Model 1
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setAiModel("Lineart/dreamshaperXL_v21TurboDPMSDE.safetensors")}
                    className={`p-3 rounded-lg text-center ${aiModel === "Lineart/dreamshaperXL_v21TurboDPMSDE.safetensors" ? "bg-blue-600 text-white" : "bg-[#171717] border border-gray-700 hover:border-blue-500"}`}
                  >
                    Model 2
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setAiModel("Lineart/aamXLAnimeMix_v10.safetensors")}
                    className={`p-3 rounded-lg text-center ${aiModel === "Lineart/aamXLAnimeMix_v10.safetensors" ? "bg-blue-600 text-white" : "bg-[#171717] border border-gray-700 hover:border-blue-500"}`}
                  >
                    Model 3
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setAiModel("Lineart/furryLineartXl_v30.safetensors")}
                    className={`p-3 rounded-lg text-center ${aiModel === "Lineart/furryLineartXl_v30.safetensors" ? "bg-blue-600 text-white" : "bg-[#171717] border border-gray-700 hover:border-blue-500"}`}
                  >
                    Model 4
                  </button>
                </div>
              </div>
              
              {/* estilo de linea */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">{t("form.line_style")}</Label>
                  <span className="text-sm text-blue-400">
                    {selectedPreset === "LoraLineart/Darwinstencil3-000007.safetensors" ? "Preset 1" :
                    selectedPreset === "LoraLineart/lineart_flux.safetensors" ? "Preset 2" :
                    selectedPreset === "anime-detailer-xl.safetensors" ? "Preset 3" : "Preset 4"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPreset("LoraLineart/Darwinstencil3-000007.safetensors")}
                    className={`p-3 rounded-lg text-center ${selectedPreset === "LoraLineart/Darwinstencil3-000007.safetensors" ? "bg-blue-600 text-white" : "bg-[#171717] border border-gray-700 hover:border-blue-500"}`}
                  >
                    Preset 1
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setSelectedPreset("LoraLineart/lineart_flux.safetensors")}
                    className={`p-3 rounded-lg text-center ${selectedPreset === "LoraLineart/lineart_flux.safetensors" ? "bg-blue-600 text-white" : "bg-[#171717] border border-gray-700 hover:border-blue-500"}`}
                  >
                    Preset 2
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setSelectedPreset("anime-detailer-xl.safetensors")}
                    className={`p-3 rounded-lg text-center ${selectedPreset === "anime-detailer-xl.safetensors" ? "bg-blue-600 text-white" : "bg-[#171717] border border-gray-700 hover:border-blue-500"}`}
                  >
                    Preset 3
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setSelectedPreset("araminta_k_colorized_blockprint.safetensors")}
                    className={`p-3 rounded-lg text-center ${selectedPreset === "araminta_k_colorized_blockprint.safetensors" ? "bg-blue-600 text-white" : "bg-[#171717] border border-gray-700 hover:border-blue-500"}`}
                  >
                    Preset 4
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading || !selectedFile}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-4 rounded-full text-lg mt-8 shadow-lg shadow-blue-900/20"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              <span className="font-medium">{t("form.processing")}</span>
            </>
          ) : !selectedFile ? (
            <span className="font-medium">{t("form.select_image_first")}</span>
          ) : (
            <span className="font-medium">{t("form.generate_stencil")}</span>
          )}
        </Button>
      </form>
    </div>
  );
}
