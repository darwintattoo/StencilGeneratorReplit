import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function Navigation() {
  const { user, logoutMutation } = useAuth();
  
  return (
    <nav className="bg-black text-white py-3 px-4 border-b border-gray-800">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-gray-800 rounded overflow-hidden flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
              <circle cx="11" cy="11" r="2"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <Link href="/" className="font-bold text-white">
              <span className="text-white">Tattoo</span>
              <span className="text-white">Stencil</span>
              <span className="text-blue-500">Pro</span>
            </Link>
            <span className="text-xs text-gray-400">By Darwin Enriquez</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {user && (
            <Link href="/my-stencils" className="hover:text-blue-400 transition text-sm mr-2">
              Mis Stencils
            </Link>
          )}
          
          <span className="text-sm text-gray-400 mx-2">ES</span>
          
          {user ? (
            <div className="flex items-center space-x-2">
              <span className="hidden md:inline text-sm">
                {user.username}
              </span>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full" 
                size="sm" 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "..." : "Salir"}
              </Button>
            </div>
          ) : (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full" size="sm" asChild>
              <Link href="/auth">Iniciar sesión</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
