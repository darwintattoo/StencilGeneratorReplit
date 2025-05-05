import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function Navigation() {
  const { user, logoutMutation } = useAuth();
  
  return (
    <nav className="bg-gray-900 text-white py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-xl font-bold text-blue-500">TattooStencilPro</Link>
          
          {user && (
            <div className="hidden md:flex space-x-4">
              <Link href="/my-stencils" className="hover:text-blue-400 transition">Mis Stencils</Link>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-4">
              <span className="hidden md:inline text-sm">
                Hola, <span className="font-medium">{user.username}</span>
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Saliendo..." : "Cerrar sesión"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/auth">Iniciar sesión</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
