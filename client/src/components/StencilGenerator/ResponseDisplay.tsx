import { Card } from "@/components/ui/card";
import { Loader2, Info, CheckCircle, AlertCircle } from "lucide-react";
import { StencilResponse, StencilError } from "@/types";

interface ResponseDisplayProps {
  response: StencilResponse | null;
  error: StencilError | null;
  isLoading: boolean;
}

export function ResponseDisplay({ response, error, isLoading }: ResponseDisplayProps) {
  return (
    <div className="bg-[#1E1E1E] rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-medium mb-4 flex items-center">
        <svg 
          className="w-5 h-5 mr-2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M7 21h10a2 2 0 002-2V9l-6-6H9a2 2 0 00-2 2v2m0 14h10a2 2 0 002-2V9a2 2 0 00-2-2h-1M7 3v2m0 14v2m0-16l6 6m-3 10h.01" 
          />
        </svg>
        API Response
      </h2>
      
      {/* Loading State */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff0000] mb-4"></div>
          <p className="text-gray-400">Processing your request...</p>
        </div>
      )}
      
      {/* Empty State */}
      {!isLoading && !response && !error && (
        <div className="py-8 text-center">
          <div className="bg-[#2D2D2D] rounded-lg p-6 inline-flex flex-col items-center">
            <Info className="h-8 w-8 text-gray-500 mb-2" />
            <p className="text-gray-400">Submit the form to see the API response here</p>
          </div>
        </div>
      )}
      
      {/* Success State */}
      {!isLoading && response && (
        <div>
          <div className="bg-green-900 bg-opacity-20 border border-green-800 rounded-md p-4 mb-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-[#4CAF50] mr-2" />
              <div>
                <p className="font-medium text-[#4CAF50]">Request successful</p>
                <p className="text-gray-400 text-sm">Your stencil is being processed</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Request ID */}
            <div>
              <h3 className="text-sm text-gray-400 mb-1">Request ID</h3>
              <div className="bg-[#2D2D2D] rounded p-3 font-mono text-sm break-all">
                {response.request_id}
              </div>
            </div>
            
            {/* Status */}
            <div>
              <h3 className="text-sm text-gray-400 mb-1">Status</h3>
              <div className="bg-[#2D2D2D] rounded p-3 font-mono text-sm">
                {response.status}
              </div>
            </div>
            
            {/* Full Response */}
            <div>
              <h3 className="text-sm text-gray-400 mb-1">Full Response</h3>
              <pre className="bg-[#2D2D2D] rounded p-3 overflow-x-auto text-xs font-mono">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {!isLoading && error && (
        <div>
          <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-md p-4 mb-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-[#F44336] mr-2" />
              <div>
                <p className="font-medium text-[#F44336]">Request failed</p>
                <p className="text-gray-400 text-sm">
                  {error.message || "Something went wrong while processing your request"}
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm text-gray-400 mb-1">Error Details</h3>
            <pre className="bg-[#2D2D2D] rounded p-3 overflow-x-auto text-xs font-mono">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
