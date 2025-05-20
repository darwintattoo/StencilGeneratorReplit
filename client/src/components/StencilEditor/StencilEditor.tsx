import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image, Line } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brush, 
  Eraser, 
  Undo2, 
  Redo2, 
  Download, 
  Save,
  ImageDown, 
  Layers
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { saveAs } from 'file-saver';

// Tipo para los trazos de pincel
interface Line {
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
  
  // Referencias a los elementos de canvas
  const stageRef = useRef<any>(null);
  const stencilLayerRef = useRef<any>(null);
  
  // Estado para las imágenes
  const [originalImageObj, setOriginalImageObj] = useState<HTMLImageElement | null>(null);
  const [stencilImageObj, setStencilImageObj] = useState<HTMLImageElement | null>(null);
  
  // Estados para la herramienta de dibujo
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [lines, setLines] = useState<Line[]>([]);
  const [undoHistory, setUndoHistory] = useState<Line[][]>([]);
  const [redoHistory, setRedoHistory] = useState<Line[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#ff0000');
  
  // Estado para la vista activa
  const [activeView, setActiveView] = useState<'compare' | 'edit'>('edit');
  
  // Estados para controlar las capas
  const [originalLayerOpacity, setOriginalLayerOpacity] = useState(0.3);
  const [originalLayerVisible, setOriginalLayerVisible] = useState(true);
  const [stencilLayerVisible, setStencilLayerVisible] = useState(true);
  
  // Cargar las imágenes cuando los props cambien
  useEffect(() => {
    // Cargar imagen original
    const origImg = new window.Image();
    origImg.crossOrigin = 'anonymous';
    origImg.src = originalImage;
    origImg.onload = () => {
      setOriginalImageObj(origImg);
    };
    
    // Cargar imagen del stencil
    const stencilImg = new window.Image();
    stencilImg.crossOrigin = 'anonymous';
    stencilImg.src = stencilImage;
    stencilImg.onload = () => {
      setStencilImageObj(stencilImg);
    };
  }, [originalImage, stencilImage]);
  
  // Función para comenzar a dibujar
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (activeView !== 'edit') return;
    
    setIsDrawing(true);
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    
    const newLine: Line = {
      tool,
      points: [pos.x, pos.y],
      color: tool === 'brush' ? brushColor : '#ffffff', // Blanco para el borrador
      strokeWidth: brushSize
    };
    
    setLines([...lines, newLine]);
    setUndoHistory([...undoHistory, [...lines]]);
    setRedoHistory([]);
  };
  
  // Función para continuar dibujando
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || activeView !== 'edit') return;
    
    const stage = e.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;
    
    const lastLine = lines[lines.length - 1];
    if (!lastLine) return;
    
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    
    setLines([...lines.slice(0, -1), lastLine]);
  };
  
  // Función para terminar de dibujar
  const handleMouseUp = () => {
    setIsDrawing(false);
  };
  
  // Función para deshacer
  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    
    const previousLines = undoHistory[undoHistory.length - 1];
    setRedoHistory([...redoHistory, [...lines]]);
    setLines(previousLines);
    setUndoHistory(undoHistory.slice(0, -1));
  };
  
  // Función para rehacer
  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    
    const nextLines = redoHistory[redoHistory.length - 1];
    setUndoHistory([...undoHistory, [...lines]]);
    setLines(nextLines);
    setRedoHistory(redoHistory.slice(0, -1));
  };
  
  // Función para exportar como PNG (solo stencil)
  const exportAsPNG = () => {
    if (!stageRef.current) return;
    
    // Primero ocultamos temporalmente la capa de la imagen original
    const originalVisible = stencilLayerRef.current?.visible();
    stencilLayerRef.current?.visible(true);
    
    const uri = stageRef.current.toDataURL({
      pixelRatio: 2
    });
    
    // Restauramos la visibilidad
    stencilLayerRef.current?.visible(originalVisible);
    
    saveAs(uri, 'stencil-edited.png');
  };
  
  // Función para exportar como PNG (combinado)
  const exportAsMergedPNG = () => {
    if (!stageRef.current) return;
    
    const uri = stageRef.current.toDataURL({
      pixelRatio: 2
    });
    saveAs(uri, 'stencil-merged.png');
  };
  
  // Función para exportar como PSD (simulado para compatibilidad con Procreate)
  const exportAsPSD = () => {
    alert("Esta función exportará un archivo compatible con Procreate que contendrá dos capas: la imagen original y el stencil editado.");
    
    // En una implementación real, aquí generaríamos un PSD con las capas
    // Para este ejercicio, exportamos las dos imágenes por separado
    // y mostramos una instrucción al usuario
    
    if (!stageRef.current) return;
    
    // Exportar la capa del stencil
    const stencilUri = stageRef.current.toDataURL({
      pixelRatio: 2
    });
    saveAs(stencilUri, 'stencil-layer.png');
    
    // Exportar la imagen original
    saveAs(originalImage, 'original-layer.png');
    
    // Mensaje con instrucciones
    alert("Se han descargado dos archivos PNG separados: la imagen original y el stencil editado. Puedes importarlos como capas en Procreate para continuar tu trabajo.");
  };
  
  // Guardar la imagen editada
  const saveEditedImage = () => {
    if (!stageRef.current || !onSave) return;
    
    const uri = stageRef.current.toDataURL({
      pixelRatio: 2
    });
    
    onSave(uri);
  };
  
  // Si no tenemos ambas imágenes cargadas, mostramos un indicador de carga
  if (!originalImageObj || !stencilImageObj) {
    return (
      <div className="flex items-center justify-center p-8 bg-black bg-opacity-30 rounded-xl">
        <div className="animate-spin mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <span>Cargando imágenes...</span>
      </div>
    );
  }
  
  // Usamos el tamaño original de la imagen sin escalar
  const width = originalImageObj.width;
  const height = originalImageObj.height;
  
  return (
    <div className="flex flex-col w-full space-y-4">
      <Tabs defaultValue="edit" className="w-full" onValueChange={(value) => setActiveView(value as 'compare' | 'edit')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="compare">{t("compare") || "Comparar"}</TabsTrigger>
          <TabsTrigger value="edit">{t("edit") || "Editar"}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="compare" className="w-full">
          <div className="flex flex-col space-y-4">
            <div className="w-full border border-gray-700 rounded-lg overflow-hidden">
              <ReactCompareSlider
                itemOne={
                  <ReactCompareSliderImage 
                    src={originalImage}
                    alt="Imagen original"
                    style={{ width: '100%', objectFit: 'contain' }}
                  />
                }
                itemTwo={
                  <ReactCompareSliderImage 
                    src={stencilImage}
                    alt="Stencil generado"
                    style={{ width: '100%', objectFit: 'contain' }}
                  />
                }
                position={50}
                className="w-full h-auto"
              />
            </div>
            <div className="text-center text-sm text-gray-400">
              {t("slide_to_compare") || "Desliza para comparar la imagen original con el stencil"}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="edit" className="w-full">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <Button
                variant={tool === 'brush' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTool('brush')}
              >
                <Brush className="h-4 w-4 mr-1" />
                {t("brush") || "Pincel"}
              </Button>
              <Button
                variant={tool === 'eraser' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTool('eraser')}
              >
                <Eraser className="h-4 w-4 mr-1" />
                {t("eraser") || "Borrador"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={undoHistory.length === 0}
              >
                <Undo2 className="h-4 w-4 mr-1" />
                {t("undo") || "Deshacer"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={redoHistory.length === 0}
              >
                <Redo2 className="h-4 w-4 mr-1" />
                {t("redo") || "Rehacer"}
              </Button>
              
              <div className="flex items-center ml-2">
                <label className="text-sm mr-2">{t("size") || "Tamaño"}:</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm ml-1">{brushSize}px</span>
              </div>
              
              {tool === 'brush' && (
                <div className="flex items-center ml-2">
                  <label className="text-sm mr-2">{t("color") || "Color"}:</label>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer border-none"
                  />
                </div>
              )}
            </div>
            
            <div className="flex border border-gray-700 rounded-lg overflow-hidden">
              <div className="flex-grow">
                <Stage
                  width={width}
                  height={height}
                  onMouseDown={handleMouseDown}
                  onMousemove={handleMouseMove}
                  onMouseup={handleMouseUp}
                  ref={stageRef}
                >
                  {/* Capa de imagen original (fondo) */}
                  {originalLayerVisible && (
                    <Layer>
                      <Image
                        image={originalImageObj}
                        width={width}
                        height={height}
                        opacity={originalLayerOpacity}
                      />
                    </Layer>
                  )}
                  
                  {/* Capa del stencil */}
                  {stencilLayerVisible && (
                    <Layer ref={stencilLayerRef}>
                      <Image
                        image={stencilImageObj}
                        width={width}
                        height={height}
                      />
                    </Layer>
                  )}
                  
                  {/* Capa de dibujo */}
                  <Layer>
                    {lines.map((line, i) => (
                      <Line
                        key={i}
                        points={line.points}
                        stroke={line.color}
                        strokeWidth={line.strokeWidth}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        globalCompositeOperation={
                          line.tool === 'eraser' ? 'destination-out' : 'source-over'
                        }
                      />
                    ))}
                  </Layer>
                </Stage>
              </div>
              
              {/* Panel de control de capas */}
              <div className="w-48 bg-gray-900 p-4 flex flex-col space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider">{t("layers") || "Capas"}</h3>
                
                {/* Control de capa original */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">{t("original_image") || "Imagen original"}</label>
                    <input
                      type="checkbox"
                      checked={originalLayerVisible}
                      onChange={(e) => setOriginalLayerVisible(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-700 text-blue-600"
                    />
                  </div>
                  
                  {originalLayerVisible && (
                    <div className="space-y-1">
                      <label className="text-xs">{t("opacity") || "Opacidad"}: {Math.round(originalLayerOpacity * 100)}%</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={originalLayerOpacity}
                        onChange={(e) => setOriginalLayerOpacity(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
                
                {/* Control de capa stencil */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">{t("stencil") || "Stencil"}</label>
                    <input
                      type="checkbox"
                      checked={stencilLayerVisible}
                      onChange={(e) => setStencilLayerVisible(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-700 text-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center text-sm text-gray-400">
              {t("use_tools_to_retouch") || "Usa las herramientas para retocar el stencil"}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="outline" onClick={exportAsPNG}>
          <Download className="h-4 w-4 mr-2" />
          {t("export_stencil_png") || "Exportar stencil (PNG)"}
        </Button>
        <Button variant="outline" onClick={exportAsMergedPNG}>
          <ImageDown className="h-4 w-4 mr-2" />
          {t("export_merged_png") || "Exportar combinado (PNG)"}
        </Button>
        {onSave && (
          <Button variant="default" onClick={saveEditedImage}>
            <Save className="h-4 w-4 mr-2" />
            {t("save") || "Guardar"}
          </Button>
        )}
      </div>
    </div>
  );
}