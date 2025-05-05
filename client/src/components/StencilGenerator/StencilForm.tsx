import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { generateStencil } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Link } from "lucide-react";
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
  const [imageUrl, setImageUrl] = useState("");
  const [lineColor, setLineColor] = useState("black");
  const [transparentBackground, setTransparentBackground] = useState(false);
  
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!imageUrl) {
      toast({
        title: "Error",
        description: "Please enter a valid image URL",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setError(null);

    try {
      const response = await generateStencil({
        imageUrl,
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
    <div className="bg-[#1E1E1E] rounded-lg p-6 shadow-lg mb-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image URL Input */}
        <div className="space-y-2">
          <Label htmlFor="imageUrl" className="font-medium">Image URL</Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <Link className="h-4 w-4 text-gray-400" />
            </span>
            <Input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              required
              className="w-full bg-[#2D2D2D] border-gray-700 pl-10 focus:ring-2 focus:ring-[#ff0000] focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-400">Enter a direct link to the image you want to convert</p>
        </div>
        
        {/* Line Color Selection */}
        <div className="space-y-2">
          <Label className="font-medium">Line Color</Label>
          <div className="flex space-x-4">
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="transparency" className="font-medium">Transparent Background</Label>
            <Switch
              id="transparency"
              checked={transparentBackground}
              onCheckedChange={setTransparentBackground}
            />
          </div>
          <p className="text-xs text-gray-400">Toggle to enable or disable transparent background for your stencil</p>
        </div>
        
        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#ff0000] hover:bg-red-700 text-white font-medium py-3 px-4 rounded-md"
        >
          {isLoading ? (
            <>
              <span>Processing...</span>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            </>
          ) : (
            <span>Generate Stencil</span>
          )}
        </Button>
      </form>
    </div>
  );
}
