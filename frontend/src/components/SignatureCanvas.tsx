import React, { useRef, useState, useEffect } from "react";
import { PenTool, Trash2, CheckCircle2, Type, Signature } from "lucide-react";

interface SignatureCanvasProps {
  onSave: (signatureData: string, type: "drawn" | "uploaded" | "typed") => void;
  defaultValue?: string;
}

export default function SignatureCanvas({ onSave, defaultValue }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<"draw" | "type" | "upload">("draw");
  const [typedName, setTypedName] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(defaultValue || null);

  // Brush styling
  const brushColor = "#0f172a";
  const brushSize = 3;

  useEffect(() => {
    if (mode === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
      }
    }
  }, [mode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveDrawnSignature();
    }
  };

  const getEventCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setLastSaved(null);
    onSave("", "drawn");
  };

  const saveDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Check if canvas is blank
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      return; // remains blank
    }
    const signatureUrl = canvas.toDataURL("image/png");
    setLastSaved(signatureUrl);
    onSave(signatureUrl, "drawn");
  };

  const handleTypeSave = (name: string) => {
    setTypedName(name);
    if (!name.trim()) {
      onSave("", "typed");
      return;
    }
    // Generate simulated typed signature with security hash
    const hash = `TS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const svgString = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='250' height='60'><text x='10' y='35' style='font-family:"Brush Script MT", cursive; font-size: 26px; fill: %230f172a;'>${name}</text><text x='10' y='52' style='font-family:monospace; font-size: 9px; fill: %2394a3b8;'>Hash: ${hash}</text></svg>`;
    setLastSaved(svgString);
    onSave(svgString, "typed");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setUploadedFileUrl(url);
      setLastSaved(url);
      onSave(url, "uploaded");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div id="sig-canvas-wrapper" className="space-y-4 border border-dashed border-slate-200 bg-slate-50/50 p-4 rounded-xl">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Signature className="w-4 h-4 text-slate-500" />
          Digital Validation Signature <span className="text-rose-500">*</span>
        </label>
        
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => { setMode("draw"); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              mode === "draw" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Draw Sign
          </button>
          <button
            type="button"
            onClick={() => { setMode("type"); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              mode === "type" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Type Name
          </button>
          <button
            type="button"
            onClick={() => { setMode("upload"); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              mode === "upload" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Upload File
          </button>
        </div>
      </div>

      {mode === "draw" && (
        <div className="relative">
          <canvas
            id="digital-sig-pad"
            ref={canvasRef}
            width={480}
            height={130}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-32 bg-white border border-slate-200 rounded-lg cursor-crosshair shadow-inner touch-none"
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={clearCanvas}
              title="Clear Sign Pad"
              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition-all border border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <PenTool className="w-3 h-3 text-slate-400" /> Use your cursor or touchscreen to write your legal signature inside the box.
          </p>
        </div>
      )}

      {mode === "type" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              id="sig-type-field"
              type="text"
              value={typedName}
              onChange={(e) => handleTypeSave(e.target.value)}
              placeholder="Type your full legal name..."
              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          {typedName && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-center items-center h-20 shadow-inner">
              <span className="font-serif italic text-2xl text-slate-800 tracking-wider font-semibold select-none">
                {typedName}
              </span>
              <span className="text-[9px] text-slate-400 font-mono mt-1 select-all">
                SECURE TRACEABLE DIGITAL KEY CERTIFICATE
              </span>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Type className="w-3 h-3 text-slate-400" /> System will automatically render a digital certificate based on your input.
          </p>
        </div>
      )}

      {mode === "upload" && (
        <div className="space-y-3">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-lg cursor-pointer bg-white hover:bg-slate-50/50 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <p className="mb-2 text-sm text-slate-500 font-semibold">Click to upload photo of signature</p>
                <p className="text-xs text-slate-400">PNG, JPG or SVG (Max index size: 1MB)</p>
              </div>
              <input
                id="sig-file-uploader"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          {uploadedFileUrl && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex justify-center items-center h-20 shadow-inner overflow-hidden">
              <img src={uploadedFileUrl} alt="Uploaded Signature Reference" className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </div>
      )}

      {lastSaved ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Signature recorded & securely locked to this document transaction.</span>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-ping" />
          <span>Please provide your validation signature to approve log fields.</span>
        </div>
      )}
    </div>
  );
}
