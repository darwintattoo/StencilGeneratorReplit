import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Stencil } from "@shared/schema";
import { Loader2, Edit3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Navigation from "@/components/layout/Navigation";

// Componente para mostrar un stencil individual
function StencilCard({ stencil }: { stencil: Stencil }) {
  const [, setLocation] = useLocation();
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4">
        <CardTitle className="text-lg">
          Stencil #{stencil.id}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
          <img 
            src={stencil.imageUrl} 
            alt={`Stencil #${stencil.id}`} 
            className="object-contain max-w-full max-h-full" 
          />
        </div>
      </CardContent>
      <CardFooter className="p-4 flex flex-col items-start gap-2">
        <div className="flex gap-2 text-sm">
          <span className="font-semibold">Color:</span>
          <span className="capitalize">{stencil.lineColor}</span>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="font-semibold">Fondo transparente:</span>
          <span>{stencil.transparentBackground ? "Sí" : "No"}</span>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="font-semibold">Creado:</span>
          <span>{new Date(stencil.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="flex gap-2 w-full mt-2">
          <Button variant="outline" className="flex-1" asChild>
            <a href={stencil.imageUrl} target="_blank" rel="noopener noreferrer">Ver</a>
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <a href={stencil.imageUrl} download={`stencil-${stencil.id}.png`}>Descargar</a>
          </Button>
          {stencil.originalImageUrl && (
            <Button 
              variant="default" 
              className="flex-1"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('original', stencil.originalImageUrl!);
                params.set('stencil', stencil.imageUrl);
                setLocation(`/editor?${params.toString()}`);
              }}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Editar
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default function MyStencils() {
  const { user } = useAuth();
  
  const { data: stencils, isLoading, error } = useQuery<Stencil[]>({
    queryKey: ["/api/my-stencils"],
  });

  return (
    <div className="bg-background text-white font-sans min-h-screen">
      <Navigation />
      <div className="container mx-auto py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Mis Stencils Guardados</h1>
          <Button variant="default" asChild>
            <Link href="/">Crear nuevo stencil</Link>
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>Error al cargar tus stencils: {error.message}</p>
          </div>
        ) : stencils && stencils.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stencils.map((stencil) => (
              <StencilCard key={stencil.id} stencil={stencil} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl mb-4">No has guardado ningún stencil aún</p>
            <Button asChild>
              <Link href="/">Crear tu primer stencil</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
