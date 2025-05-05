import { StencilForm } from "@/components/StencilGenerator/StencilForm";
import { ResponseDisplay } from "@/components/StencilGenerator/ResponseDisplay";
import { useState } from "react";
import { StencilResponse, StencilError } from "@/types";

export default function Home() {
  const [response, setResponse] = useState<StencilResponse | null>(null);
  const [error, setError] = useState<StencilError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="bg-background text-white font-sans min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-2xl md:text-4xl font-bold mb-2 text-blue-500">TattooStencilPro</h1>
          <h2 className="text-xl md:text-2xl font-medium text-gray-300 mb-3">by Darwin Enriquez</h2>
          <p className="text-gray-400">Create stencil art from your images with customizable options</p>
        </header>

        {/* Form Component */}
        <StencilForm
          setResponse={setResponse}
          setError={setError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />

        {/* Response Display Component */}
        <ResponseDisplay
          response={response}
          error={error}
          isLoading={isLoading}
        />
        
        {/* Footer */}
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} TattooStencilPro by Darwin Enriquez. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
