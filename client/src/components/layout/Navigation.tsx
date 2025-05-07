import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { GlobeIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Importamos el logo oficial
import logoImage from "../../assets/tattoo-stencil-pro-logo.png";

export default function Navigation() {
  const { user, logoutMutation } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  
  return (
    <nav className="bg-black text-white py-3 px-4 border-b border-gray-800">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <img src={logoImage} alt="TattooStencilPro" className="h-9" />
          </Link>
        </div>
        
        <div className="flex items-center space-x-4">
          {user && (
            <Link href="/my-stencils" className="hover:text-blue-400 transition text-sm mr-2">
              {t("nav.mystencils")}
            </Link>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1">
                <GlobeIcon className="h-4 w-4" />
                <span className="uppercase">{language}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage("en")} className={language === "en" ? "bg-muted" : ""}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("es")} className={language === "es" ? "bg-muted" : ""}>
                Español
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
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
                {logoutMutation.isPending ? "..." : t("nav.signout")}
              </Button>
            </div>
          ) : (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full" size="sm" asChild>
              <Link href="/auth">{t("nav.signin")}</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
