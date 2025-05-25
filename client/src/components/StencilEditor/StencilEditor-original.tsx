import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image, Line } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Brush, 
  Eraser, 
  Undo2, 
  Redo2, 
  Download, 
  Save,
  ZoomIn,
  ZoomOut,
  Move,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import {
  Slider
} from '@/components/ui/slider';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types
interface Line {
  tool: 'brush' | 'eraser';
  points: number[];
  color: string;
  strokeWidth: number;
  affectsStencil?: boolean;
}

interface StencilEditorProps {
  originalImage: string;
  stencilImage: string;
  onSave?: (editedImageUrl: string) => void;
}

export default function StencilEditor({ originalImage, stencilImage, onSave }: StencilEditorProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  // References
  const stageRef = useRef<Konva.Stage | null>(null);
  const stencilLayerRef = useRef<Konva.Layer | null>(null);
  
  // Image states
  const [originalImageObj, setOriginalImageObj] = useState<HTMLImageElement | null>(null);
  const [stencilImageObj, setStencilImageObj] = useState<HTMLImageElement | null>(null);
  
  // Drawing states
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [lines, setLines] = useState<Line[]>([]);
  const [undoHistory, setUndoHistory] = useState<Line[][]>([]);
  const [redoHistory, setRedoHistory] = useState<Line[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(10);
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [eraserTarget, setEraserTarget] = useState<'drawing' | 'stencil'>('drawing');
  
  // Canvas view states
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'drawing' | 'panning'>('drawing');
  const [isDragging, setIsDragging] = useState(false);
  
  // Layer visibility and opacity
  const [originalLayerOpacity, setOriginalLayerOpacity] = useState(0.5);
  const [originalLayerVisible, setOriginalLayerVisible] = useState(true);
  const [stencilLayerVisible, setStencilLayerVisible] = useState(true);
  
  // Touch handling
  const lastPointerPosition = useRef<{ x: number, y: number } | null>(null);
  
  // Load images
  useEffect(() => {
    // Load original image
    const origImg = new window.Image();
    origImg.crossOrigin = 'anonymous';
    origImg.src = originalImage;
    origImg.onload = () => {
      setOriginalImageObj(origImg);
    };
    
    // Load stencil image
    const stencilImg = new window.Image();
    stencilImg.crossOrigin = 'anonymous';
    stencilImg.src = stencilImage;
    stencilImg.onload = () => {
      setStencilImageObj(stencilImg);
    };
  }, [originalImage, stencilImage]);
  
  // Handle mouse down
  const handleMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (mode !== 'drawing') return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // Convert to scaled coordinates
    const x = (pointerPos.x - position.x) / scale;
    const y = (pointerPos.y - position.y) / scale;
    
    setIsDrawing(true);
    
    // Create new line
    const newLine: Line = {
      tool,
      points: [x, y, x, y],
      color: tool === 'brush' ? brushColor : '#ffffff',
      strokeWidth: tool === 'brush' ? brushSize : eraserSize,
      affectsStencil: tool === 'eraser' && eraserTarget === 'stencil'
    };
    
    // Save for undo history
    setUndoHistory([...undoHistory, [...lines]]);
    setRedoHistory([]);
    
    // Add new line
    setLines([...lines, newLine]);
    
    // Save position for smoothing
    lastPointerPosition.current = { x, y };
  };
  
  // Handle mouse move
  const handleMouseMove = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing || mode !== 'drawing') return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // Convert to scaled coordinates
    const x = (pointerPos.x - position.x) / scale;
    const y = (pointerPos.y - position.y) / scale;
    
    // Update last line
    const updatedLines = [...lines];
    const lastLine = updatedLines[updatedLines.length - 1];
    
    if (lastPointerPosition.current) {
      // For smoother lines, interpolate points
      const dx = x - lastPointerPosition.current.x;
      const dy = y - lastPointerPosition.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 1) {
        const steps = tool === 'eraser' ? Math.ceil(distance) * 2 : Math.max(1, Math.floor(distance / 2));
        
        for (let i = 1; i <= steps; i++) {
          const ratio = i / steps;
          const newX = lastPointerPosition.current.x + dx * ratio;
          const newY = lastPointerPosition.current.y + dy * ratio;
          lastLine.points = [...lastLine.points, newX, newY];
        }
      } else {
        lastLine.points = [...lastLine.points, x, y];
      }
    } else {
      lastLine.points = [...lastLine.points, x, y];
    }
    
    // Update position reference
    lastPointerPosition.current = { x, y };
    
    // Update lines
    updatedLines[updatedLines.length - 1] = lastLine;
    setLines(updatedLines);
  };
  
  // Handle mouse up
  const handleMouseUp = () => {
    setIsDrawing(false);
    lastPointerPosition.current = null;
  };
  
  // Handle wheel for zooming
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    
    // Adjust zoom
    const newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
    const limitedScale = Math.max(0.1, Math.min(newScale, 10));
    
    setScale(limitedScale);
    
    const newPos = {
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    };
    
    setPosition(newPos);
  };
  
  // Handle stage drag start
  const handleDragStart = () => {
    if (mode !== 'panning') return;
    setIsDragging(true);
  };
  
  // Handle stage drag end
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (mode !== 'panning') return;
    setIsDragging(false);
    setPosition({
      x: e.target.x(),
      y: e.target.y(),
    });
  };
  
  // Toggle drawing/panning mode
  const toggleMode = () => {
    setMode(mode === 'drawing' ? 'panning' : 'drawing');
  };
  
  // Handle undo
  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    
    const previousLines = undoHistory[undoHistory.length - 1];
    setRedoHistory([...redoHistory, [...lines]]);
    setLines(previousLines);
    setUndoHistory(undoHistory.slice(0, -1));
  };
  
  // Handle redo
  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    
    const nextLines = redoHistory[redoHistory.length - 1];
    setUndoHistory([...undoHistory, [...lines]]);
    setLines(nextLines);
    setRedoHistory(redoHistory.slice(0, -1));
  };
  
  // Handle download
  const handleDownload = () => {
    if (!stageRef.current) return;
    
    try {
      const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = 'tattoo-stencil.png';
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: t('stencilEditor.downloadSuccess'),
        description: t('stencilEditor.downloadSuccessDesc'),
      });
    } catch (error) {
      console.error('Error downloading image', error);
      toast({
        title: t('stencilEditor.downloadError'),
        description: t('stencilEditor.downloadErrorDesc'),
        variant: 'destructive',
      });
    }
  };
  
  // Handle save
  const handleSave = () => {
    if (!stageRef.current) return;
    
    try {
      const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
      
      if (onSave) {
        onSave(uri);
      }
      
      toast({
        title: t('stencilEditor.saveSuccess'),
        description: t('stencilEditor.saveSuccessDesc'),
      });
    } catch (error) {
      console.error('Error saving image', error);
      toast({
        title: t('stencilEditor.saveError'),
        description: t('stencilEditor.saveErrorDesc'),
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap gap-2 p-2 bg-neutral-100 dark:bg-neutral-900 border-b">
        {/* Drawing Tools */}
        <Button
          size="sm"
          variant={tool === 'brush' ? 'default' : 'outline'}
          onClick={() => setTool('brush')}
        >
          <Brush className="h-4 w-4 mr-1" />
          {t('stencilEditor.brush')}
        </Button>
        
        <Button
          size="sm"
          variant={tool === 'eraser' ? 'default' : 'outline'}
          onClick={() => setTool('eraser')}
        >
          <Eraser className="h-4 w-4 mr-1" />
          {t('stencilEditor.eraser')}
        </Button>
        
        {tool === 'eraser' && (
          <Select 
            value={eraserTarget} 
            onValueChange={(value) => setEraserTarget(value as 'drawing' | 'stencil')}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder={t('stencilEditor.eraseTarget')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="drawing">{t('stencilEditor.eraseDrawing')}</SelectItem>
              <SelectItem value="stencil">{t('stencilEditor.eraseStencil')}</SelectItem>
            </SelectContent>
          </Select>
        )}
        
        {/* Separator */}
        <div className="mx-2 border-r border-neutral-300 dark:border-neutral-700" />
        
        {/* History Controls */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleUndo}
          disabled={undoHistory.length === 0}
        >
          <Undo2 className="h-4 w-4 mr-1" />
          {t('stencilEditor.undo')}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleRedo}
          disabled={redoHistory.length === 0}
        >
          <Redo2 className="h-4 w-4 mr-1" />
          {t('stencilEditor.redo')}
        </Button>
        
        {/* Separator */}
        <div className="mx-2 border-r border-neutral-300 dark:border-neutral-700" />
        
        {/* Navigation Controls */}
        <Button
          size="sm"
          variant={mode === 'panning' ? 'default' : 'outline'}
          onClick={toggleMode}
        >
          <Move className="h-4 w-4 mr-1" />
          {mode === 'drawing' ? t('stencilEditor.pan') : t('stencilEditor.draw')}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const newScale = Math.min(scale * 1.2, 10);
            setScale(newScale);
          }}
        >
          <ZoomIn className="h-4 w-4 mr-1" />
          {t('stencilEditor.zoomIn')}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const newScale = Math.max(scale / 1.2, 0.1);
            setScale(newScale);
          }}
        >
          <ZoomOut className="h-4 w-4 mr-1" />
          {t('stencilEditor.zoomOut')}
        </Button>
        
        {/* Separator */}
        <div className="mx-2 border-r border-neutral-300 dark:border-neutral-700" />
        
        {/* Layer Controls */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOriginalLayerVisible(!originalLayerVisible)}
        >
          {originalLayerVisible ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
          {t('stencilEditor.originalLayer')}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStencilLayerVisible(!stencilLayerVisible)}
        >
          {stencilLayerVisible ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
          {t('stencilEditor.stencilLayer')}
        </Button>
        
        {/* Spacer */}
        <div className="flex-grow" />
        
        {/* Export Controls */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-1" />
          {t('stencilEditor.download')}
        </Button>
        
        <Button
          size="sm"
          variant="default"
          onClick={handleSave}
        >
          <Save className="h-4 w-4 mr-1" />
          {t('stencilEditor.save')}
        </Button>
      </div>
      
      {/* Settings Panel */}
      <Tabs defaultValue="brush" className="border-b bg-neutral-50 dark:bg-neutral-900">
        <TabsList className="p-2">
          <TabsTrigger value="brush">{t('stencilEditor.brushSettings')}</TabsTrigger>
          <TabsTrigger value="layers">{t('stencilEditor.layerSettings')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="brush" className="p-2 space-y-2">
          {/* Brush Size */}
          <div className="flex items-center space-x-2">
            <span className="text-sm w-24">{t('stencilEditor.brushSize')}</span>
            <Slider 
              value={[tool === 'brush' ? brushSize : eraserSize]} 
              min={1} 
              max={50} 
              step={1}
              onValueChange={(value) => {
                if (tool === 'brush') {
                  setBrushSize(value[0]);
                } else {
                  setEraserSize(value[0]);
                }
              }}
              className="flex-grow"
            />
            <span className="text-sm w-8 text-right">
              {tool === 'brush' ? brushSize : eraserSize}
            </span>
          </div>
          
          {/* Brush Color (only for brush) */}
          {tool === 'brush' && (
            <div className="flex items-center space-x-2">
              <span className="text-sm w-24">{t('stencilEditor.brushColor')}</span>
              <input 
                type="color" 
                value={brushColor} 
                onChange={(e) => setBrushColor(e.target.value)}
                className="h-8 w-8 border rounded"
              />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="layers" className="p-2 space-y-2">
          {/* Original Layer Opacity */}
          <div className="flex items-center space-x-2">
            <span className="text-sm w-32">{t('stencilEditor.originalOpacity')}</span>
            <Slider 
              value={[originalLayerOpacity * 100]} 
              min={0} 
              max={100} 
              step={1}
              onValueChange={(value) => setOriginalLayerOpacity(value[0] / 100)}
              className="flex-grow"
              disabled={!originalLayerVisible}
            />
            <span className="text-sm w-8 text-right">
              {Math.round(originalLayerOpacity * 100)}%
            </span>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Canvas */}
      <div className="flex-grow relative overflow-hidden">
        <Stage
          ref={stageRef}
          width={window.innerWidth}
          height={window.innerHeight - 150} // Adjust for toolbars
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable={mode === 'panning'}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onMouseleave={handleMouseUp}
          onTouchstart={handleMouseDown}
          onTouchmove={handleMouseMove}
          onTouchend={handleMouseUp}
          onWheel={handleWheel}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Original Image Layer */}
          {originalLayerVisible && (
            <Layer opacity={originalLayerOpacity}>
              {originalImageObj && (
                <Image 
                  image={originalImageObj} 
                  listening={false}
                />
              )}
            </Layer>
          )}
          
          {/* Stencil Image Layer */}
          {stencilLayerVisible && (
            <Layer ref={stencilLayerRef}>
              {stencilImageObj && (
                <Image 
                  image={stencilImageObj} 
                  listening={false}
                  globalCompositeOperation="source-over"
                />
              )}
              
              {/* Eraser strokes that affect the stencil */}
              {lines
                .filter(line => line.affectsStencil)
                .map((line, i) => (
                  <Line
                    key={`stencil-line-${i}`}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation="destination-out"
                    listening={false}
                  />
                ))}
            </Layer>
          )}
          
          {/* Drawing Layer */}
          <Layer>
            {lines
              .filter(line => !line.affectsStencil)
              .map((line, i) => (
                <Line
                  key={`drawing-line-${i}`}
                  points={line.points}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                  listening={false}
                />
              ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}