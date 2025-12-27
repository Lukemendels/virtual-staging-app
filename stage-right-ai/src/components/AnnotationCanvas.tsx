import * as React from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { Eraser, Pen, Undo, RotateCcw } from "lucide-react";

interface AnnotationCanvasProps {
    width: number | string;
    height: number | string;
    backgroundImage?: string;
    onExport: (dataUrl: string) => void;
}

export const AnnotationCanvas = React.forwardRef<ReactSketchCanvasRef, AnnotationCanvasProps>(
    ({ width, height, backgroundImage, onExport }, ref) => {
        const [eraseMode, setEraseMode] = React.useState(false);

        const canvasRef = ref as React.MutableRefObject<ReactSketchCanvasRef>;

        return (
            <div className="relative group overflow-hidden rounded-lg border border-indigo-500/50 shadow-2xl h-full w-full">
                <ReactSketchCanvas
                    ref={canvasRef}
                    width={typeof width === 'number' ? `${width}px` : width}
                    height={typeof height === 'number' ? `${height}px` : height}
                    strokeWidth={15}
                    strokeColor="red" // Visual prompting works best with Red
                    canvasColor="transparent"
                    backgroundImage={backgroundImage}
                    exportWithBackgroundImage={true} // We want to burn the red lines into the image for the API
                    style={{ border: "none" }}
                />

                {/* Floating Toolbar */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => {
                            setEraseMode(false);
                            canvasRef.current?.eraseMode(false);
                        }}
                        className={`p-2 rounded-full transition-colors ${!eraseMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Draw (Red Helper)"
                    >
                        <Pen size={16} />
                    </button>
                    <button
                        onClick={() => {
                            setEraseMode(true);
                            canvasRef.current?.eraseMode(true);
                        }}
                        className={`p-2 rounded-full transition-colors ${eraseMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Eraser"
                    >
                        <Eraser size={16} />
                    </button>
                    <div className="w-px h-4 bg-white/20 mx-1" />
                    <button
                        onClick={() => canvasRef.current?.undo()}
                        className="p-2 rounded-full text-slate-400 hover:text-white transition-colors"
                        title="Undo"
                    >
                        <Undo size={16} />
                    </button>
                    <button
                        onClick={() => canvasRef.current?.clearCanvas()}
                        className="p-2 rounded-full text-slate-400 hover:text-red-400 transition-colors"
                        title="Clear All"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>
        );
    }
);

AnnotationCanvas.displayName = "AnnotationCanvas";
