import { StencilForm } from "@/components/StencilGenerator/StencilForm";
import { ResponseDisplay } from "@/components/StencilGenerator/ResponseDisplay";
import { useState } from "react";
import { StencilResponse, StencilError } from "@/types";
import Navigation from "@/components/layout/Navigation";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

export default function Home() {
  const [response, setResponse] = useState<StencilResponse | null>(null);
  const [error, setError] = useState<StencilError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Función para guardar el stencil generado
  const saveStencil = async () => {
    if (!response || !response.outputs?.image) {
      toast({
        title: "Error",
        description: "No hay ningún stencil para guardar",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      
      // Obtener valores del formulario ocultos en la respuesta
      const lineColor = response.inputs?.line_color || "red";
      const transparentBackground = response.inputs?.activar_transparencia || true;
      
      // Enviar solicitud para guardar el stencil
      await apiRequest("POST", "/api/save-stencil", {
        imageUrl: response.outputs.image,
        lineColor,
        transparentBackground
      });
      
      toast({
        title: "Stencil guardado",
        description: "Tu stencil ha sido guardado correctamente",
      });
    } catch (error) {
      console.error("Error al guardar stencil:", error);
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "Ocurrió un error al guardar el stencil",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-black text-white font-sans min-h-screen">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Hero section */}
        <header className="mb-12 text-center pt-8">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-blue-500">TattooStencilPro</h1>
          <h2 className="text-2xl md:text-3xl font-light text-gray-300 mb-6">by Darwin Enriquez</h2>
          <h3 className="text-4xl md:text-5xl font-bold mb-4 mt-8">Revolutionize Your Tattoo Designs</h3>
          <p className="text-xl text-gray-400 mb-8">Professional AI-powered stencil creator</p>
        </header>

        {/* Form Component */}
        <StencilForm
          setResponse={setResponse}
          setError={setError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />

        {/* Response Display Component */}
        <div>
          <ResponseDisplay
            response={response}
            error={error}
            isLoading={isLoading}
          />
          
          {response && response.outputs?.image && user && (
            <div className="mt-4 flex justify-center">
              <Button 
                onClick={saveStencil} 
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar stencil
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} TattooStencilPro by Darwin Enriquez. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
