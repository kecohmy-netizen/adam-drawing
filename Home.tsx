
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useEffect, useRef, useState, FormEvent} from 'react';
import {GoogleGenAI, Content} from '@google/genai';
import {
  ChevronDown,
  LoaderCircle,
  SendHorizontal,
  Trash2,
  X,
  ImagePlus,
  UserCircle2,
  Plus,
  Type,
  Download,
} from 'lucide-react';

function parseError(error: string) {
  const regex = /{"error":(.*)}/gm;
  const m = regex.exec(error);
  try {
    if (!m) return error;
    const e = m[1];
    const err = JSON.parse(e);
    return err.message || error;
  } catch (e) {
    return error;
  }
}

function useApiKeyCheck() {
  const [hasKey, setHasKey] = useState(false);
  
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);
  
  const openKeyPicker = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // Assume the key selection was successful to mitigate race conditions
      setHasKey(true);
    }
  };

  return { hasKey, openKeyPicker, setHasKey };
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundImageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // Tracks images and names as parallel arrays
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceNames, setReferenceNames] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-image');
  const [isPrecise, setIsPrecise] = useState(true);

  const { hasKey, openKeyPicker, setHasKey } = useApiKeyCheck();

  useEffect(() => {
    if (generatedImage && canvasRef.current) {
      const img = new window.Image();
      img.onload = () => {
        (backgroundImageRef as any).current = img;
        drawImageToCanvas();
      };
      img.src = generatedImage;
    }
  }, [generatedImage]);

  useEffect(() => {
    if (canvasRef.current) {
      initializeCanvas();
    }
  }, []);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const drawImageToCanvas = () => {
    if (!canvasRef.current || !backgroundImageRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      backgroundImageRef.current,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.nativeEvent.offsetX || (e.nativeEvent.touches?.[0]?.clientX - rect.left)) * scaleX,
      y: (e.nativeEvent.offsetY || (e.nativeEvent.touches?.[0]?.clientY - rect.top)) * scaleY,
    };
  };

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const {x, y} = getCoordinates(e);
    if (e.type === 'touchstart') e.preventDefault();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    if (e.type === 'touchmove') e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const {x, y} = getCoordinates(e);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setGeneratedImage(null);
    (backgroundImageRef as any).current = null;
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `gemini-co-drawing-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleColorChange = (e: any) => setPenColor(e.target.value);
  const openColorPicker = () => colorInputRef.current?.click();
  const handleKeyDown = (e: any) => { if (e.key === 'Enter' || e.key === ' ') openColorPicker(); };

  const triggerFileUpload = () => {
    if (referenceImages.length >= 5) {
      alert("Maximum 5 character images allowed.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setReferenceImages(prev => [...prev, event.target?.result as string]);
          setReferenceNames(prev => [...prev, ""]); // Add empty name for new character
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleNameChange = (index: number, newName: string) => {
    setReferenceNames(prev => {
      const updated = [...prev];
      updated[index] = newName;
      return updated;
    });
  };

  const removeReference = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
    setReferenceNames(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (selectedModel === 'gemini-3-pro-image-preview' && !hasKey) {
      await openKeyPicker();
      return;
    }

    if (!canvasRef.current) return;
    setIsLoading(true);

    try {
      const canvas = canvasRef.current;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error("Could not initialize canvas context");
      
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);

      const drawingData = tempCanvas.toDataURL('image/png').split(',')[1];
      // Create a new GoogleGenAI instance right before making an API call to ensure it uses up-to-date key
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

      const parts: any[] = [];
      
      // Add reference images
      referenceImages.forEach((img) => {
        const data = img.split(',')[1];
        parts.push({ inlineData: { data, mimeType: 'image/png' } });
      });

      // Add user sketch
      parts.push({ inlineData: { data: drawingData, mimeType: 'image/png' } });

      const numRefs = referenceImages.length;
      
      // Construct character identity mapping
      const characterIdentities = referenceNames
        .map((name, i) => `Image ${i+1} is the character named '${name || `Character ${i+1}`}'`)
        .join(". ");

      const precisionInstruction = isPrecise 
        ? `STRICT CONSISTENCY: ${characterIdentities}. Maintain absolute consistency with their specific facial features, hair, clothing, and colors as shown in their respective reference images. Draw them in the situation described below.`
        : `CREATIVE INSPIRATION: ${characterIdentities}. Use these as a guide but feel free to stylize.`;

      const finalPrompt = numRefs > 0 
        ? `${precisionInstruction}\n\nReferences are in Images 1 through ${numRefs}. Current sketch/layout is Image ${numRefs + 1}. Task: ${prompt}`
        : `${precisionInstruction}\n\nTask: ${prompt}`;

      parts.push({ text: finalPrompt });

      const contents: Content[] = [
        {
          role: 'USER',
          parts: parts,
        },
      ];

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          }
        },
      });

      let newImageData = null;
      if (response.candidates?.[0]?.content?.parts) {
        // Find the image part as per guidelines (do not assume first part)
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            newImageData = part.inlineData.data;
          }
        }
      }

      if (newImageData) {
        setGeneratedImage(`data:image/png;base64,${newImageData}`);
      } else {
        alert('Failed to generate image. Please try again.');
      }
    } catch (error: any) {
      console.error('Error submitting drawing:', error);
      const msg = error.message || '';
      // If requested entity not found, reset key selection and prompt again
      if (msg.includes("Requested entity was not found")) {
        setHasKey(false);
        await openKeyPicker();
      }
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const closeErrorModal = () => setShowErrorModal(false);

  useEffect(() => {
    const preventTouchDefault = (e: any) => { if (isDrawing) e.preventDefault(); };
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', preventTouchDefault, { passive: false });
      canvas.addEventListener('touchmove', preventTouchDefault, { passive: false });
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener('touchstart', preventTouchDefault);
        canvas.removeEventListener('touchmove', preventTouchDefault);
      }
    };
  }, [isDrawing]);

  return (
    <>
      <div className="min-h-screen notebook-paper-bg text-gray-900 flex flex-col justify-start items-center">
        <main className="container mx-auto px-3 sm:px-6 py-5 sm:py-10 pb-32 max-w-6xl w-full">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-4 gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold mb-0 leading-tight font-mega">
                Gemini Co-Drawing
              </h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1 font-mono">
                Upload up to 5 heroes, name them, sketch the scene.
              </p>
            </div>

            <menu className="flex flex-wrap items-center bg-gray-300 rounded-full p-2 shadow-sm self-start md:self-auto gap-2">
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-10 rounded-full bg-white pl-3 pr-8 text-xs sm:text-sm text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 appearance-none border-2 border-white"
                >
                  <option value="gemini-2.5-flash-image">2.5 Flash</option>
                  <option value="gemini-3-pro-image-preview">3 Pro (High Quality)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-center bg-white h-10 px-3 rounded-full shadow-sm border-2 border-white transition-all hover:bg-gray-50">
                <button 
                  type="button"
                  onClick={() => setIsPrecise(!isPrecise)}
                  className="flex items-center gap-1.5 focus:outline-none"
                  title="Precise mode keeps the characters consistent across references.">
                  <span className="text-xs sm:text-sm font-bold text-gray-700 select-none">
                    Precise 🍌
                  </span>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${isPrecise ? 'bg-yellow-400' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isPrecise ? 'left-4.5' : 'left-0.5'}`} />
                  </div>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={triggerFileUpload}
                disabled={referenceImages.length >= 5}
                title="Upload Character Reference (Max 5)"
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed">
                <ImagePlus className="w-5 h-5 text-gray-700" />
              </button>

              <button
                type="button"
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center border-2 border-white shadow-sm transition-transform hover:scale-110"
                onClick={openColorPicker}
                onKeyDown={handleKeyDown}
                style={{backgroundColor: penColor}}>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={penColor}
                  onChange={handleColorChange}
                  className="opacity-0 absolute w-px h-px"
                />
              </button>

              <button
                type="button"
                onClick={handleExport}
                title="Export Image (PNG)"
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110">
                <Download className="w-5 h-5 text-gray-700" />
              </button>

              <button
                type="button"
                onClick={clearCanvas}
                title="Clear Canvas"
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110">
                <Trash2 className="w-5 h-5 text-gray-700" />
              </button>
            </menu>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Sidebar / Standby Area for Multiple Reference Images */}
            <div className="lg:col-span-3 order-2 lg:order-1">
              <div className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sticky top-6">
                <div className="flex items-center gap-2 mb-4 border-b-2 border-black pb-2">
                  <UserCircle2 className="w-5 h-5" />
                  <h3 className="font-mega text-sm uppercase tracking-wider">Heroes Standby</h3>
                </div>
                
                <div className="flex flex-col gap-4 mb-4">
                  {referenceImages.map((img, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
                      <div className="flex gap-3">
                        <div className="w-16 h-16 shrink-0 relative border-2 border-black bg-white overflow-hidden">
                          <img 
                            src={img} 
                            alt={`Ref ${idx + 1}`} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                          <label className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter flex items-center gap-1">
                            Character {idx + 1} Name
                          </label>
                          <input 
                            type="text"
                            value={referenceNames[idx]}
                            onChange={(e) => handleNameChange(idx, e.target.value)}
                            placeholder="e.g. Adam"
                            className="w-full p-1 text-sm font-mono border-b-2 border-black bg-transparent focus:outline-none"
                          />
                        </div>
                      </div>
                      <button 
                        /* Fix: Changed 'index' to 'idx' to match loop parameter name */
                        onClick={() => removeReference(idx)}
                        className="absolute -top-2 -right-2 bg-black text-white p-0.5 rounded-full hover:bg-red-600 transition-colors shadow-md border border-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {referenceImages.length < 5 && (
                    <button 
                      onClick={triggerFileUpload}
                      className="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-gray-50 transition-all group"
                    >
                      <Plus className="w-6 h-6 text-gray-300 group-hover:text-black" />
                      <span className="text-[10px] font-mono text-gray-400">Add Hero ({referenceImages.length}/5)</span>
                    </button>
                  )}
                </div>

                {referenceImages.length === 0 && (
                  <p className="text-xs font-mono text-gray-400 text-center py-4 px-2 border-2 border-dashed border-gray-200 rounded-lg mb-4">
                    Upload your characters to keep them consistent across drawings.
                  </p>
                )}

                {selectedModel === 'gemini-3-pro-image-preview' && !hasKey && (
                  <div className="mt-4 p-3 bg-yellow-50 border-2 border-yellow-400 text-[10px] font-mono">
                    <p className="mb-2">Pro models require a paid API key.</p>
                    <a 
                      href="https://ai.google.dev/gemini-api/docs/billing" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline text-yellow-700 block mb-2"
                    >
                      Billing Setup
                    </a>
                    <button 
                      onClick={openKeyPicker}
                      className="w-full py-1 bg-yellow-400 font-bold uppercase hover:bg-yellow-500 transition-colors"
                    >
                      Select Key
                    </button>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t-2 border-gray-100 italic text-[10px] text-gray-400 font-mono">
                  Tip: Giving each hero a unique name (like "Adam" and "Maya") helps Gemini follow your complex prompts perfectly.
                </div>
              </div>
            </div>

            {/* Main Canvas Area */}
            <div className="lg:col-span-9 order-1 lg:order-2">
              <div className="w-full mb-6 relative group">
                <canvas
                  ref={canvasRef}
                  width={960}
                  height={540}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="border-4 border-black w-full hover:cursor-crosshair sm:h-[60vh] h-[30vh] min-h-[320px] bg-white touch-none shadow-2xl"
                />
                {!generatedImage && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity">
                    <p className="text-4xl sm:text-6xl font-bold font-mega uppercase tracking-widest text-black">Canvas</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="w-full">
                <div className="relative">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={referenceImages.length > 0 ? `Tell Gemini what the characters should do...` : "Describe what Gemini should draw..."}
                    className="w-full p-4 sm:p-6 pr-12 sm:pr-20 text-sm sm:text-xl border-4 border-black bg-white text-gray-800 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] focus:ring-0 focus:outline-none transition-all font-mono placeholder:text-gray-300"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black text-white hover:cursor-pointer hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
                  >
                    {isLoading ? (
                      <LoaderCircle className="w-6 sm:w-8 h-6 sm:h-8 animate-spin" />
                    ) : (
                      <SendHorizontal className="w-6 sm:w-8 h-6 sm:h-8" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {showErrorModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full p-8">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold font-mega uppercase text-red-600">Error</h3>
                <button onClick={closeErrorModal} className="p-1 hover:bg-gray-100 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="font-mono text-gray-700 mb-8 break-words">{parseError(errorMessage)}</p>
              <button onClick={closeErrorModal} className="w-full py-3 bg-black text-white font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
