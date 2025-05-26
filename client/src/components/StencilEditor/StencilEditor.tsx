import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { 
  PenTool, 
  Eraser, 
  Layers, 
  Eye, 
  EyeOff, 
  GripVertical,
  ArrowLeft 
} from 'lucide-react';
import { useLocation } from 'wouter';

// Hook personalizado para manejar la lógica del canvas
function useStencilCanvas() {
  const [tool, setTool] = useState<'brush' | 'eraser' | 'move'>('brush');
  const [brushSize, setBrushSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(10);
  const [layers, setLayers] = useState({
    drawing: { visible: true, opacity: 100 },
    stencil: { visible: true, opacity: 100 },
    original: { visible: true, opacity: 100 }
  });

  const toggleLayer = (key: string, visible: boolean) => {
    setLayers(prev => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], visible }
    }));
  };

  const setOpacity = (key: string, opacity: number) => {
    setLayers(prev => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], opacity }
    }));
  };

  return {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    eraserSize,
    setEraserSize,
    layers,
    toggleLayer,
    setOpacity
  };
}

interface StencilEditorProps {
  originalImage?: string;
  stencilImage?: string;
}

export default function StencilEditor({ originalImage, stencilImage }: StencilEditorProps) {
  const [location, setLocation] = useLocation();
  const stageRef = useRef<any>(null);
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
  const [stencilImg, setStencilImg] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  const {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    eraserSize,
    setEraserSize,
    layers,
    toggleLayer,
    setOpacity
  } = useStencilCanvas();

  // Cargar imágenes
  useEffect(() => {
    if (originalImage) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setOriginalImg(img);
        // Ajustar tamaño del stage según la imagen
        const aspectRatio = img.width / img.height;
        const maxWidth = 800;
        const maxHeight = 600;
        
        let newWidth = maxWidth;
        let newHeight = maxWidth / aspectRatio;
        
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = maxHeight * aspectRatio;
        }
        
        setStageSize({ width: newWidth, height: newHeight });
      };
      img.src = originalImage;
    }
  }, [originalImage]);

  useEffect(() => {
    if (stencilImage) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setStencilImg(img);
      img.src = stencilImage;
    }
  }, [stencilImage]);

  // Manejo del dibujo
  const handleMouseDown = (e: any) => {
    if (tool === 'move') return;
    
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const newLine = {
      tool,
      points: [pos.x, pos.y],
      strokeWidth: tool === 'brush' ? brushSize : eraserSize,
      globalCompositeOperation: tool === 'eraser' ? 'destination-out' : 'source-over'
    };
    setLines([...lines, newLine]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || tool === 'move') return;
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const newLines = [...lines];
    const lastLine = newLines[newLines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    setLines(newLines);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    
    // Limpiar hit canvas después de usar el borrador
    if (tool === 'eraser' && stageRef.current) {
      setTimeout(() => {
        if (stageRef.current) {
          const layers = stageRef.current.find('Layer');
          layers.forEach((layer: any) => {
            try {
              const hitCanvas = layer.getHitCanvas();
              if (hitCanvas) {
                const hitContext = hitCanvas.getContext('2d');
                hitContext.clearRect(0, 0, stageSize.width, stageSize.height);
                layer.clearHitCache();
              }
            } catch (e) {
              console.log('Error limpiando hit canvas:', e);
            }
            layer.batchDraw();
          });
          stageRef.current.batchDraw();
        }
      }, 50);
    }
  };

  return (
    <div className="h-screen bg-gray-900 relative overflow-hidden">
      {/* Header con botón back */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/')}
          className="text-white hover:bg-gray-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>
      </div>

      {/* Toolbar flotante central */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-black/70 backdrop-blur-md rounded-2xl p-2 flex gap-2">
          <Button
            variant={tool === 'brush' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('brush')}
            className="w-12 h-12"
          >
            <PenTool className="w-5 h-5" />
          </Button>
          
          <Button
            variant={tool === 'eraser' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('eraser')}
            className="w-12 h-12"
          >
            <Eraser className="w-5 h-5" />
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="w-12 h-12">
                <Layers className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-gray-900 border-gray-700">
              <div className="pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Layers</h3>
                
                <div className="space-y-3">
                  {/* Drawing Layer */}
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <Switch
                        checked={layers.drawing.visible}
                        onCheckedChange={(checked) => toggleLayer('drawing', checked)}
                      />
                      <span className="text-white text-sm flex-1">Drawing</span>
                    </div>
                    <div className="ml-7">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Opacity</span>
                        <Slider
                          value={[layers.drawing.opacity]}
                          onValueChange={([value]) => setOpacity('drawing', value)}
                          max={100}
                          min={0}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-400 w-8">{layers.drawing.opacity}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Stencil Layer */}
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <Switch
                        checked={layers.stencil.visible}
                        onCheckedChange={(checked) => toggleLayer('stencil', checked)}
                      />
                      <span className="text-white text-sm flex-1">Stencil</span>
                    </div>
                    <div className="ml-7">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Opacity</span>
                        <Slider
                          value={[layers.stencil.opacity]}
                          onValueChange={([value]) => setOpacity('stencil', value)}
                          max={100}
                          min={0}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-xs text-gray-400 w-8">{layers.stencil.opacity}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Original Layer (locked) */}
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-gray-600" />
                      <Switch
                        checked={layers.original.visible}
                        onCheckedChange={(checked) => toggleLayer('original', checked)}
                      />
                      <span className="text-white text-sm flex-1">Original</span>
                      <span className="text-xs text-gray-500">locked</span>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Brush size slider (izquierda) */}
      {tool === 'brush' && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-30">
          <div className="bg-black/70 backdrop-blur-md rounded-full p-4 h-48 flex items-center">
            <div className="transform -rotate-90 w-32">
              <Slider
                value={[brushSize]}
                onValueChange={([value]) => setBrushSize(value)}
                max={30}
                min={1}
                step={1}
                className="w-32"
              />
              <div className="text-white text-xs text-center mt-2 transform rotate-90">
                {brushSize}px
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Eraser size slider (derecha) */}
      {tool === 'eraser' && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-30">
          <div className="bg-black/70 backdrop-blur-md rounded-full p-4 h-48 flex items-center">
            <div className="transform -rotate-90 w-32">
              <Slider
                value={[eraserSize]}
                onValueChange={([value]) => setEraserSize(value)}
                max={100}
                min={1}
                step={1}
                className="w-32"
              />
              <div className="text-white text-xs text-center mt-2 transform rotate-90">
                {eraserSize}px
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas principal */}
      <div className="flex items-center justify-center h-full">
        <div className="relative">
          <Stage
            width={stageSize.width}
            height={stageSize.height}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            ref={stageRef}
            className="border border-gray-700 rounded-lg shadow-2xl"
          >
            {/* Layer Original */}
            {layers.original.visible && (
              <Layer opacity={layers.original.opacity / 100}>
                {originalImg && (
                  <KonvaImage
                    image={originalImg}
                    width={stageSize.width}
                    height={stageSize.height}
                  />
                )}
              </Layer>
            )}

            {/* Layer Stencil */}
            {layers.stencil.visible && (
              <Layer opacity={layers.stencil.opacity / 100}>
                {stencilImg && (
                  <KonvaImage
                    image={stencilImg}
                    width={stageSize.width}
                    height={stageSize.height}
                  />
                )}
              </Layer>
            )}

            {/* Layer Drawing */}
            {layers.drawing.visible && (
              <Layer opacity={layers.drawing.opacity / 100}>
                {lines.map((line, i) => (
                  <Line
                    key={i}
                    points={line.points}
                    stroke={line.tool === 'brush' ? '#ef4444' : '#ffffff'}
                    strokeWidth={line.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={line.globalCompositeOperation}
                    perfectDrawEnabled={true}
                    shadowForStrokeEnabled={false}
                  />
                ))}
              </Layer>
            )}
          </Stage>
        </div>
      </div>
    </div>
  );
}