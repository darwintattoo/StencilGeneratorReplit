import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation, isLoading } = useAuth();
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    email: "",
  });

  // Redireccionar si el usuario ya está autenticado
  if (user) {
    return <Redirect to="/" />;
  }

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginForm({
      ...loginForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterForm({
      ...registerForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerForm);
  };

  const isPendingLogin = loginMutation.isPending;
  const isPendingRegister = registerMutation.isPending;

  return (
    <div className="flex min-h-screen">
      {/* Columna izquierda - Formularios */}
      <div className="flex items-center justify-center w-full md:w-1/2 p-6">
        <Tabs defaultValue="login" className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
            <TabsTrigger value="register">Registrarse</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Iniciar sesión</CardTitle>
                <CardDescription>
                  Ingresa tus datos para acceder a tu cuenta y compartir tus stencils
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLoginSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Usuario o email</Label>
                    <Input 
                      id="login-username" 
                      name="username" 
                      value={loginForm.username}
                      onChange={handleLoginChange}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input 
                      id="login-password" 
                      name="password" 
                      type="password" 
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      required 
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isPendingLogin}
                  >
                    {isPendingLogin ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      "Iniciar sesión"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
          
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Crear cuenta</CardTitle>
                <CardDescription>
                  Regístrate para guardar y compartir tus diseños de stencils
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRegisterSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Nombre de usuario</Label>
                    <Input 
                      id="register-username" 
                      name="username" 
                      value={registerForm.username}
                      onChange={handleRegisterChange}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Correo electrónico</Label>
                    <Input 
                      id="register-email" 
                      name="email" 
                      type="email" 
                      value={registerForm.email}
                      onChange={handleRegisterChange}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input 
                      id="register-password" 
                      name="password" 
                      type="password" 
                      value={registerForm.password}
                      onChange={handleRegisterChange}
                      required 
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isPendingRegister}
                  >
                    {isPendingRegister ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      "Crear cuenta"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Columna derecha - Hero section */}
      <div className="hidden md:flex md:w-1/2 bg-black flex-col justify-center items-center p-12 text-white">
        <h1 className="text-4xl font-bold mb-6">TattooStencilPro</h1>
        <h2 className="text-2xl font-semibold mb-4">por Darwin Enriquez</h2>
        <p className="text-lg mb-8 text-center">
          Convierte imágenes en stencils profesionales para tatuajes con un solo clic
        </p>
        <div className="space-y-4 text-center">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p>Procesamiento rápido de imágenes</p>
          </div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p>Opciones de personalización</p>
          </div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p>Guarda y comparte tus diseños</p>
          </div>
        </div>
      </div>
    </div>
  );
}
