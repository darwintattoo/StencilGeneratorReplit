import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image, Line } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Brush, 
  Eraser, 
  Undo2, 
  Redo2, 
  Download,
  ZoomIn,
  ZoomOut,
  Move
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

// Type for the stroke (brush/eraser)
interface StrokeType {
  tool: 'brush' | 'eraser';
  points: number[];
  color: string;
  strokeWidth: number;
}

interface StencilEditorProps {
  originalImage: string;
  stencilImage: string;
  onSave?: (editedImageUrl: string) => void;
}

export default function StencilEditor({ originalImage, stencilImage, onSave }: StencilEditorProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  // References to canvas elements
  const stageRef = useRef<any>(null);
  
  // Image states
  const [originalImageObj, setOriginalImageObj] = useState<HTMLImageElement | null>(null);
  const [stencilImageObj, setStencilImageObj] = useState<HTMLImageElement | null>(null);
  
  // Drawing tool states
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [strokes, setStrokes] = useState<StrokeType[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(10);
  const [brushColor, setBrushColor] = useState('#000000');
  
  // Undo/redo history
  const [undoHistory, setUndoHistory] = useState<StrokeType[][]>([]);
  const [redoHistory, setRedoHistory] = useState<StrokeType[][]>([]);
  
  // Canvas view states
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'drawing' | 'panning'>('drawing');
  
  // Layer visibility and opacity
  const [originalLayerOpacity, setOriginalLayerOpacity] = useState(0.5);
  const [originalLayerVisible, setOriginalLayerVisible] = useState(true);
  const [stencilLayerVisible, setStencilLayerVisible] = useState(true);
  
  // Load images when props change
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
  
  // Handle mouse down on canvas
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (mode !== 'drawing') return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // Convert to scaled coordinates
    const x = (pointerPos.x - position.x) / scale;
    const y = (pointerPos.y - position.y) / scale;
    
    setIsDrawing(true);
    
    // Create a new stroke
    const newStroke: StrokeType = {
      tool,
      points: [x, y],
      color: tool === 'brush' ? brushColor : '#ffffff',
      strokeWidth: tool === 'brush' ? brushSize : eraserSize
    };
    
    // Save for undo history
    setUndoHistory([...undoHistory, [...strokes]]);
    setRedoHistory([]);
    
    // Add the new stroke
    setStrokes([...strokes, newStroke]);
  };
  
  // Handle mouse move for drawing
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || mode !== 'drawing') return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    
    // Convert to scaled coordinates
    const x = (pointerPos.x - position.x) / scale;
    const y = (pointerPos.y - position.y) / scale;
    
    // Add point to the last stroke
    const updatedStrokes = [...strokes];
    const lastStroke = updatedStrokes[updatedStrokes.length - 1];
    lastStroke.points = [...lastStroke.points, x, y];
    
    setStrokes(updatedStrokes);
  };
  
  // Handle mouse up to end drawing
  const handleMouseUp = () => {
    setIsDrawing(false);
  };
  
  // Handle zoom in
  const handleZoomIn = () => {
    const newScale = Math.min(scale * 1.2, 10);
    setScale(newScale);
  };
  
  // Handle zoom out
  const handleZoomOut = () => {
    const newScale = Math.max(scale / 1.2, 0.1);
    setScale(newScale);
  };
  
  // Toggle between drawing and panning modes
  const toggleMode = () => {
    setMode(mode === 'drawing' ? 'panning' : 'drawing');
  };
  
  // Handle undo
  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    
    const previousStrokes = undoHistory[undoHistory.length - 1];
    
    setRedoHistory([...redoHistory, [...strokes]]);
    setStrokes(previousStrokes);
    setUndoHistory(undoHistory.slice(0, -1));
  };
  
  // Handle redo
  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    
    const nextStrokes = redoHistory[redoHistory.length - 1];
    
    setUndoHistory([...undoHistory, [...strokes]]);
    setStrokes(nextStrokes);
    setRedoHistory(redoHistory.slice(0, -1));
  };
  
  // Save canvas as image
  const handleSave = () => {
    if (!stageRef.current) return;
    
    try {
      const uri = stageRef.current.toDataURL();
      
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
  
  // Download canvas as image
  const handleDownload = () => {
    if (!stageRef.current) return;
    
    try {
      const uri = stageRef.current.toDataURL();
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
  
  return (
    <div className="flex flex-col h-full w-full">
      <div className="toolbar flex flex-wrap gap-2 p-2 bg-neutral-100 dark:bg-neutral-900 border-b">
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
        
        <div className="mx-2 border-r border-neutral-300 dark:border-neutral-700" />
        
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
        
        <div className="mx-2 border-r border-neutral-300 dark:border-neutral-700" />
        
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
          onClick={handleZoomIn}
        >
          <ZoomIn className="h-4 w-4 mr-1" />
          {t('stencilEditor.zoomIn')}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleZoomOut}
        >
          <ZoomOut className="h-4 w-4 mr-1" />
          {t('stencilEditor.zoomOut')}
        </Button>
        
        <div className="flex-grow" />
        
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
          {t('stencilEditor.save')}
        </Button>
      </div>
      
      <div className="flex-grow relative overflow-hidden">
        <Stage
          ref={stageRef}
          width={window.innerWidth}
          height={window.innerHeight - 100} // Adjust for toolbar height
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable={mode === 'panning'}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
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
            <Layer>
              {stencilImageObj && (
                <Image 
                  image={stencilImageObj} 
                  listening={false}
                />
              )}
            </Layer>
          )}
          
          {/* Drawing Layer */}
          <Layer>
            {strokes.map((stroke, i) => (
              <Line
                key={i}
                points={stroke.points}
                stroke={stroke.color}
                strokeWidth={stroke.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
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