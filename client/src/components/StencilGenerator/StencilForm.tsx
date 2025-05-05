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
  const [lineColor, setLineColor] = useState("red");
  const [transparentBackground, setTransparentBackground] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
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
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: t("form.error"),
        description: t("form.error_file_type"),
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
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setError(null);

    try {
      // Usar la función de subida con el archivo seleccionado
      const response = await uploadImageForStencil({
        image: selectedFile,
        lineColor,
        transparentBackground
      });
      
      setResponse(response);
      setError(null);
    } catch (err) {
      setResponse(null);
      setError(err as StencilError);
      
      toast({
        title: "Error",
        description: (err as Error).message || "Failed to generate stencil",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0d0d0d] rounded-xl p-8 shadow-xl mb-8 border border-gray-800">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Image Input Options */}
        <div className="space-y-4">
          <Label className="font-medium text-lg">{t("form.upload_label")}</Label>
          
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
        
        {/* Line Color Selection */}
        <div className="space-y-4">
          <Label className="font-medium text-lg">{t("form.line_color")}</Label>
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
        
        {/* Transparency Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="transparency" className="font-medium text-lg">{t("form.transparent_bg")}</Label>
            <Switch
              id="transparency"
              checked={transparentBackground}
              onCheckedChange={setTransparentBackground}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>
          <p className="text-sm text-gray-400">{t("form.transparent_bg_help")}</p>
        </div>
        
        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-full text-lg mt-6"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span>{t("form.processing")}</span>
            </>
          ) : (
            <span>{t("form.generate_stencil")}</span>
          )}
        </Button>
      </form>
    </div>
  );
}
