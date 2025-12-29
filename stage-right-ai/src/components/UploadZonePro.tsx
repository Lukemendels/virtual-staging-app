"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, Loader2, Sparkles, Download, PenLine, RefreshCw, AlertTriangle } from "lucide-react";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { CreditModal } from "./CreditModal";
import { ReactSketchCanvasRef } from "react-sketch-canvas";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { loadStripe } from "@stripe/stripe-js";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export const UploadZonePro = () => {
    const { user } = useAuth();
    const [preview, setPreview] = useState<string | null>(null);
    const [stagedImage, setStagedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedStyle, setSelectedStyle] = useState("modern_farmhouse");
    const [selectedRoomType, setSelectedRoomType] = useState("living_room");

    // New State for Credit System
    const [credits, setCredits] = useState<number>(0);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [editsRemaining, setEditsRemaining] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Annotation State
    const [isAnnotating, setIsAnnotating] = useState(false);
    const canvasRef = useRef<ReactSketchCanvasRef>(null);

    // Modal State
    const [showCreditModal, setShowCreditModal] = useState(false);

    const styles = [
        { label: "Modern Farmhouse", value: "modern_farmhouse" },
        { label: "Historic / Transitional", value: "historic" },
        { label: "Luxury Contemporary", value: "luxury" },
        { label: "Industrial Chic", value: "industrial" },
        { label: "Scandi-Minimalist", value: "scandi" }
    ];

    const roomTypes = [
        { label: "Living Room", value: "living_room" },
        { label: "Bedroom", value: "bedroom" },
        { label: "Dining Room", value: "dining" },
        { label: "Kitchen", value: "kitchen" },
        { label: "Basement / Rec Room", value: "basement" },
        { label: "Bonus Room / FROG", value: "bonus_room" },
        { label: "Front Yard (Curb Appeal)", value: "front_yard" },
        { label: "Backyard / Garden", value: "backyard" },
        { label: "Patio / Deck", value: "patio" },
        { label: "Pool Area", value: "pool" },
        { label: "Balcony / Terrace", value: "balcony" }
    ];

    // Listen to real-time credit updates
    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            setCredits(doc.data()?.credits || 0);
        });
        return () => unsub();
    }, [user]);

    const processFile = (file: File) => {
        if (!file.type.startsWith("image/")) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
            setStagedImage(null);
            setProjectId(null); // Reset project
            setEditsRemaining(null);
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleStage = async () => {
        if (!preview || !user) return;

        // Optimistic check
        if (!projectId && credits < 1) {
            setShowCreditModal(true);
            return;
        }

        setLoading(true);

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/stage-pro", { // POINTS TO PRO API
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    image: preview,
                    style: selectedStyle,
                    roomType: selectedRoomType,
                    projectId: projectId, // Pass existing project ID if any
                    prompt: tweakPrompt
                }),
            });

            const data = await response.json();

            if (response.status === 429 || response.status === 503) {
                toast.error("High traffic. Retrying...");
                return;
            }

            if (response.status === 500) {
                toast.error("System error. Please try again.");
                return;
            }

            if (data.error) {
                console.error("Staging failed:", data.error);
                toast.error(data.error);
            } else if (data.result && data.result.startsWith("data:image")) {
                setStagedImage(data.result);
                setProjectId(data.projectId);
                setEditsRemaining(data.editsRemaining);
                toast.success(projectId ? "Scene Updated (Pro)!" : "Pro Staging Complete!");
            } else {
                console.warn("Unexpected response format:", data);
                toast.error("Received unexpected response from AI.");
            }
        } catch (error) {
            console.error("Staging error:", error);
            toast.error("An error occurred. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpscaleAndDownload = async () => {
        if (!stagedImage) return;

        setLoading(true);
        try {
            // 1. Upscale
            const response = await fetch("/api/upscale", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    image: stagedImage,
                }),
            });

            const data = await response.json();

            if (response.status === 429 || response.status === 503) {
                toast.error("High traffic... please wait a moment.");
                return;
            }

            if (data.error) {
                console.error("Upscaling failed:", data.error);
                toast.error("Failed to upscale image.");
                return;
            }

            let finalImage = stagedImage;
            if (data.result && data.result.startsWith("data:image")) {
                finalImage = data.result;
                setStagedImage(finalImage);
                toast.success("Image upscaled to 4K!");
            }

            // 2. Download
            const link = document.createElement("a");
            link.href = finalImage;
            link.download = "staged-room-pro-4k.jpg";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Upscaling error:", error);
            toast.error("An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const [tweakPrompt, setTweakPrompt] = useState("");

    const handleDirectorUpdate = async () => {
        if (!stagedImage) return;
        setLoading(true);
        try {
            let imagePayload = stagedImage;

            // If annotating, export the visual prompt
            if (isAnnotating && canvasRef.current) {
                try {
                    const annotatedImage = await canvasRef.current.exportImage("jpeg");
                    imagePayload = annotatedImage;
                } catch (e) {
                    console.error("Failed to export annotation", e);
                }
            }

            const token = await user?.getIdToken();
            // Note: Refine still uses the standard refine API for now unless we want a pro refine too?
            // Let's stick to standard refine for now to minimize complexity, or maybe Refine should also be Pro?
            // The user said "second page that looks similar... testing gemini 3". 
            // Usually keeping refine consistent (standard) is safer, but if they want to test Pro, ideally everything is Pro.
            // However, creating a `refine-pro` might be overkill if `stage-pro` is the main test. 
            // I'll keep `api/refine` (standard) for tweaks to ensure stability, unless requested otherwise.
            // Actually, `refine` logic is model-agnostic in the frontend, but the backend dictates the model. 
            // I'll keep it pointing to `/api/refine` for now.
            const response = await fetch("/api/refine", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    image: imagePayload,
                    tweakPrompt: tweakPrompt,
                    projectId: projectId
                }),
            });

            const data = await response.json();

            if (data.error) {
                toast.error(data.error);
            } else if (data.result) {
                setStagedImage(data.result);
                if (data.editsRemaining !== undefined) setEditsRemaining(data.editsRemaining);
                if (isAnnotating) setIsAnnotating(false);
                setTweakPrompt("");
                toast.success("Scene Refined!");
            }
        } catch (error) {
            console.error("Refine error:", error);
            toast.error("Failed to refine image.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-8 p-6">
            {/* Header Section */}
            <div className="text-center space-y-4 mb-12 relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Gemini 3.0 Pro Preview</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold text-white font-serif tracking-tight">
                    ListingFlow <span className="text-indigo-500">Pro</span>
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto font-light">
                    Test the next generation of AI staging models.
                </p>

                {/* Upload Area */}
                {!stagedImage && (
                    <Card
                        className={`relative border-2 border-dashed transition-all duration-300 overflow-hidden ${isDragging
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-slate-700 hover:border-indigo-500 bg-slate-950"
                            }`}
                    >
                        <div
                            className="p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[400px]"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => !preview && fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileSelect}
                            />

                            {preview ? (
                                <div className="relative w-full h-full flex flex-col items-center">
                                    <img
                                        src={preview}
                                        alt="Preview"
                                        className="max-h-[400px] w-auto object-contain rounded-lg shadow-2xl mb-8 border border-slate-800"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fileInputRef.current?.click();
                                        }}
                                        className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                    >
                                        Change Image
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="w-24 h-24 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-xl">
                                        <Upload className="w-10 h-10 text-indigo-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-semibold text-white">
                                            Upload your photo
                                        </h3>
                                        <p className="text-slate-400 text-lg">
                                            Drag & drop or click to browse
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* Control Bar & Action Button */}
                {preview && !stagedImage && (
                    <Card className="bg-slate-950 border-slate-800 shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-white">Pro Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none text-slate-300">Style</label>
                                    <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                                        <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-white">
                                            <SelectValue placeholder="Select Style" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            {styles.map((style) => (
                                                <SelectItem key={style.value} value={style.value} className="focus:bg-slate-800 focus:text-white">{style.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none text-slate-300">Room Type</label>
                                    <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                                        <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-white">
                                            <SelectValue placeholder="Select Room Type" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            {roomTypes.map((type) => (
                                                <SelectItem key={type.value} value={type.value} className="focus:bg-slate-800 focus:text-white">{type.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none text-slate-300">
                                    Director Mode (Optional)
                                </label>
                                <Input
                                    placeholder="e.g. Scandinavian style, bright, airy, add a blue rug..."
                                    value={tweakPrompt}
                                    onChange={(e) => setTweakPrompt(e.target.value)}
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-amber-500">Preview Model Warning</h4>
                                    <p className="text-xs text-amber-200/60">
                                        This uses the experimental Gemini 3.0 Pro model. Results may vary and could be unstable. Costs 1 credit per generation.
                                    </p>
                                </div>
                            </div>

                            <Button
                                size="lg"
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                                onClick={handleStage}
                                disabled={loading || credits < 1}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating with Gemini 3 Pro...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Stage Room (1 Credit)
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Results View */}
                {stagedImage && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-500">
                        {/* Original Image Card */}
                        <Card className="bg-slate-950 border-slate-800 h-full flex flex-col shadow-xl">
                            <CardHeader className="flex flex-row items-center space-y-0 min-h-[80px]">
                                <CardTitle className="text-slate-400">Original Room</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-black/40 rounded-lg mx-6 mb-6 border border-slate-800/50">
                                <img
                                    src={preview!}
                                    alt="Original"
                                    className="w-full h-auto rounded-md"
                                />
                            </CardContent>
                            <CardFooter className="p-4 justify-center">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setStagedImage(null);
                                        setPreview(null);
                                        setProjectId(null);
                                        setEditsRemaining(null);
                                        setTweakPrompt("");
                                    }}
                                    className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                >
                                    Stage Another Room
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Staged Image Card */}
                        <Card className="bg-slate-950 border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.15)] h-full flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 min-h-[80px]">
                                <CardTitle className="text-indigo-400 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5" />
                                    Gemini 3.0 Pro Result
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        {selectedStyle} • {selectedRoomType}
                                    </span>
                                    {editsRemaining !== null && (
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${editsRemaining > 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                                            {editsRemaining} Edits Remaining
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-black/40 rounded-lg mx-6 border border-slate-800/50">
                                <div className="relative w-full h-auto min-h-[50px]">
                                    <img
                                        src={stagedImage}
                                        alt="Staged"
                                        className="w-full h-auto rounded-md"
                                    />
                                    {isAnnotating && (
                                        <div className="absolute inset-0 z-10">
                                            <AnnotationCanvas
                                                ref={canvasRef}
                                                width="100%"
                                                height="100%"
                                                backgroundImage={stagedImage}
                                                onExport={() => { }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="flex-col gap-4 p-6">
                                {/* Director's Mode Input */}
                                <div className="w-full space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-slate-300">Director Mode (Standard Refine)</label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsAnnotating(!isAnnotating)}
                                            className={`${isAnnotating ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white'} h-7 px-2`}
                                        >
                                            <PenLine className="w-4 h-4 mr-1.5" />
                                            {isAnnotating ? 'Annotating...' : 'Annotate'}
                                        </Button>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. Make the sofa blue, add a plant in the corner..."
                                            value={tweakPrompt}
                                            onChange={(e) => setTweakPrompt(e.target.value)}
                                            className="bg-slate-900 border-slate-700 text-white"
                                        />
                                        <Button
                                            className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                                            onClick={handleDirectorUpdate}
                                            disabled={loading || (editsRemaining !== null && editsRemaining <= 0)}
                                        >
                                            {loading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                    Update
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex w-full gap-2 pt-2">
                                    <Button
                                        className="w-full transition-all text-white font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/20"
                                        onClick={handleUpscaleAndDownload}
                                        disabled={loading}
                                        size="lg"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" />
                                                Upscale to 4K & Download
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>
                )}
            </div>

            <CreditModal isOpen={showCreditModal} onClose={() => setShowCreditModal(false)} />
        </div>
    );
};
