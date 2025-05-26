import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PenTool, 
  Eraser, 
  Layers, 
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
  const [viewTransform, setViewTransform] = useState({
    x: 0,
    y: 0,
    scale: 1
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

  const handleGesture = (type: 'pan' | 'pinch', data: any) => {
    if (type === 'pan') {
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + data.deltaX,
        y: prev.y + data.deltaY
      }));
    } else if (type === 'pinch') {
      const newScale = Math.max(0.1, Math.min(5, data.scale));
      setViewTransform(prev => ({
        ...prev,
        scale: newScale,
        x: data.centerX - (data.centerX - prev.x) * (newScale / prev.scale),
        y: data.centerY - (data.centerY - prev.y) * (newScale / prev.scale)
      }));
    }
  };

  const resetView = () => {
    setViewTransform({ x: 0, y: 0, scale: 1 });
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
    setOpacity,
    viewTransform,
    handleGesture,
    resetView
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
  const [nativeSize, setNativeSize] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPointerPosition, setLastPointerPosition] = useState({ x: 0, y: 0 });

  const {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    eraserSize,
    setEraserSize,
    layers,
    toggleLayer,
    setOpacity,
    viewTransform,
    handleGesture,
    resetView
  } = useStencilCanvas();

  // Cargar imágenes en resolución nativa
  useEffect(() => {
    if (stencilImage) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setStencilImg(img);
        // Usar el tamaño nativo del stencil
        setNativeSize({ width: img.width, height: img.height });
      };
      img.src = stencilImage;
    }
  }, [stencilImage]);

  useEffect(() => {
    if (originalImage) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setOriginalImg(img);
      img.src = originalImage;
    }
  }, [originalImage]);

  // Manejo de gestos táctiles y mouse
  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getRelativePointerPosition();
    
    if (tool === 'move' || e.evt.button === 1) { // Middle mouse or move tool
      setIsPanning(true);
      setLastPointerPosition(pos);
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      setIsDrawing(true);
      // Ajustar posición por el transform de la vista
      const adjustedPos = {
        x: (pos.x - viewTransform.x) / viewTransform.scale,
        y: (pos.y - viewTransform.y) / viewTransform.scale
      };
      
      const newLine = {
        tool,
        points: [adjustedPos.x, adjustedPos.y],
        strokeWidth: tool === 'brush' ? brushSize : eraserSize,
        globalCompositeOperation: tool === 'eraser' ? 'destination-out' : 'source-over'
      };
      setLines([...lines, newLine]);
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getRelativePointerPosition();

    if (isPanning) {
      const deltaX = pos.x - lastPointerPosition.x;
      const deltaY = pos.y - lastPointerPosition.y;
      handleGesture('pan', { deltaX, deltaY });
      setLastPointerPosition(pos);
      return;
    }

    if (!isDrawing || tool === 'move') return;
    
    // Ajustar posición por el transform de la vista
    const adjustedPos = {
      x: (pos.x - viewTransform.x) / viewTransform.scale,
      y: (pos.y - viewTransform.y) / viewTransform.scale
    };
    
    const newLines = [...lines];
    const lastLine = newLines[newLines.length - 1];
    lastLine.points = lastLine.points.concat([adjustedPos.x, adjustedPos.y]);
    setLines(newLines);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsPanning(false);
    
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
                hitContext.clearRect(0, 0, nativeSize.width, nativeSize.height);
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

  // Manejo de wheel para zoom
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = viewTransform.scale;
    const pointer = stage.getPointerPosition();

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    handleGesture('pinch', {
      scale: Math.max(0.1, Math.min(5, newScale)),
      centerX: pointer.x,
      centerY: pointer.y
    });
  };

  return (
    <div className="h-screen bg-gray-900 relative overflow-hidden">
      {/* Header con botón back */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-4 z-50"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/')}
          className="text-white hover:bg-gray-800 backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          back
        </Button>
      </motion.div>

      {/* Toolbar flotante central */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="absolute top-6 left-1/2 transform -translate-x-1/2 z-40"
      >
        <div className="bg-black/70 backdrop-blur-md rounded-2xl p-3 flex gap-3 shadow-2xl border border-gray-700/30">
          <Button
            variant={tool === 'brush' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('brush')}
            className="w-12 h-12 transition-all duration-200"
          >
            <PenTool className="w-5 h-5" />
          </Button>
          
          <Button
            variant={tool === 'eraser' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('eraser')}
            className="w-12 h-12 transition-all duration-200"
          >
            <Eraser className="w-5 h-5" />
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="w-12 h-12 transition-all duration-200">
                <Layers className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-gray-900 border-gray-700">
              <SheetTitle className="text-lg font-semibold text-white mb-4">Capas</SheetTitle>
              
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-3"
              >
                {/* Drawing Layer */}
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <Switch
                      checked={layers.drawing.visible}
                      onCheckedChange={(checked) => toggleLayer('drawing', checked)}
                    />
                    <span className="text-white text-sm flex-1 font-medium">Drawing</span>
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
                      <span className="text-xs text-gray-400 w-10 text-right">{layers.drawing.opacity}%</span>
                    </div>
                  </div>
                </div>

                {/* Stencil Layer */}
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <Switch
                      checked={layers.stencil.visible}
                      onCheckedChange={(checked) => toggleLayer('stencil', checked)}
                    />
                    <span className="text-white text-sm flex-1 font-medium">Stencil</span>
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
                      <span className="text-xs text-gray-400 w-10 text-right">{layers.stencil.opacity}%</span>
                    </div>
                  </div>
                </div>

                {/* Original Layer (locked) */}
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 opacity-75">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-600" />
                    <Switch
                      checked={layers.original.visible}
                      onCheckedChange={(checked) => toggleLayer('original', checked)}
                    />
                    <span className="text-white text-sm flex-1 font-medium">Original</span>
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">locked</span>
                  </div>
                </div>
              </motion.div>
            </SheetContent>
          </Sheet>
        </div>
      </motion.div>

      {/* Brush size slider (izquierda) */}
      <AnimatePresence>
        {tool === 'brush' && (
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.2 }}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-30"
          >
            <div className="bg-black/70 backdrop-blur-md rounded-full p-4 h-48 flex items-center shadow-2xl border border-gray-700/30">
              <div className="transform -rotate-90 w-32">
                <Slider
                  value={[brushSize]}
                  onValueChange={([value]) => setBrushSize(value)}
                  max={30}
                  min={1}
                  step={1}
                  className="w-32"
                />
                <div className="text-white text-xs text-center mt-2 transform rotate-90 font-medium">
                  {brushSize}px
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Eraser size slider (derecha) */}
      <AnimatePresence>
        {tool === 'eraser' && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.2 }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-30"
          >
            <div className="bg-black/70 backdrop-blur-md rounded-full p-4 h-48 flex items-center shadow-2xl border border-gray-700/30">
              <div className="transform -rotate-90 w-32">
                <Slider
                  value={[eraserSize]}
                  onValueChange={([value]) => setEraserSize(value)}
                  max={100}
                  min={1}
                  step={1}
                  className="w-32"
                />
                <div className="text-white text-xs text-center mt-2 transform rotate-90 font-medium">
                  {eraserSize}px
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas principal */}
      <div className="flex items-center justify-center h-full">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative shadow-2xl rounded-lg overflow-hidden border border-gray-700"
        >
          <Stage
            width={Math.min(window.innerWidth - 100, 1000)}
            height={Math.min(window.innerHeight - 100, 700)}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onWheel={handleWheel}
            onDblTap={resetView}
            ref={stageRef}
            scaleX={viewTransform.scale}
            scaleY={viewTransform.scale}
            x={viewTransform.x}
            y={viewTransform.y}
          >
            {/* Layer Original */}
            {layers.original.visible && (
              <Layer opacity={layers.original.opacity / 100}>
                {originalImg && (
                  <KonvaImage
                    image={originalImg}
                    width={nativeSize.width}
                    height={nativeSize.height}
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
                    width={nativeSize.width}
                    height={nativeSize.height}
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
        </motion.div>
      </div>

      {/* Indicador de zoom */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: viewTransform.scale !== 1 ? 1 : 0 }}
        className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md rounded-lg px-3 py-2 text-white text-sm"
      >
        {Math.round(viewTransform.scale * 100)}%
      </motion.div>
    </div>
  );
}