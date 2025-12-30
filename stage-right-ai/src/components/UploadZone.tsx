"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, Loader2, Sparkles, Download, Lock, Unlock, RefreshCw, PenLine } from "lucide-react";
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

export const UploadZone = () => {
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
            setIsPaid(false);
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

    const handleStage = async (isRetry = false) => {
        if (!preview || !user) return;

        // Optimistic check
        if (!projectId && credits < 1 && !isRetry) {
            setShowCreditModal(true);
            return;
        }

        setLoading(true);

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/stage", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    image: preview,
                    style: selectedStyle,
                    roomType: selectedRoomType,
                    projectId: projectId,
                    prompt: tweakPrompt,
                    isRetry: isRetry // Pass retry flag
                }),
            });

            const data = await response.json();

            // 1. Handle Verification Failure (Auto-Retry)
            if (response.status === 422 && data.shouldRetry && !isRetry) {
                console.log("Verification failed, auto-retrying...", data.reason);
                toast.info(`Quality check failed (${data.reason}). Optimizing and retrying...`);

                // Recursive call with retry flag
                await handleStage(true);
                return;
            }

            if (response.status === 429 || response.status === 503) {
                toast.error("High traffic. Retrying... please wait.");
                return;
            }

            if (data.error) {
                console.error("Staging failed:", data.error);
                toast.error(data.error);
            } else if (data.result && data.result.startsWith("data:image")) {
                setStagedImage(data.result);
                setProjectId(data.projectId);
                setEditsRemaining(data.editsRemaining);

                if (data.verification) {
                    console.log("Verification passed:", data.verification);
                }
                toast.success(isRetry ? "Scene Updated (Optimized)!" : "Staging Complete!");
            } else {
                toast.error("Received unexpected response.");
            }
        } catch (error) {
            console.error("Staging error:", error);
            toast.error("Connection error.");
        } finally {
            // Only stop loading if we are NOT retrying, or if the retry finished
            if (!isRetry || (isRetry && !loading)) {
                setLoading(false);
            }
            // Actually, simplistic logic: We await the recursive call, so we can unset loading here.
            // But wait, if we await handleStage(true), the inner one sets loading=false at its end.
            // So we just strictly set it false here.
            setLoading(false);
        }
    };

    const handleUnlock = async () => { /* ... existing ... */ };

    // ... (Upscale logic remains) ...
    const handleUpscaleAndDownload = async () => { /* ... existing ... */ };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-8 p-6">
            {/* ... Header & Upload Card (Existing) ... */}

            <div className="text-center space-y-4 mb-12 relative">
                <h1 className="text-4xl md:text-5xl font-bold text-white font-serif tracking-tight">
                    ListingFlow
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto font-light">
                    Transform empty rooms into beautiful, furnished spaces in seconds.
                </p>

                {!stagedImage && (
                    /* ... Upload Card ... */
                    <Card className={`relative border-2 border-dashed transition-all duration-300 overflow-hidden ${isDragging ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700 hover:border-indigo-500 bg-slate-950"}`}>
                        <div className="p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[400px]"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => !preview && fileInputRef.current?.click()}
                        >
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                            {preview ? (
                                <div className="relative w-full h-full flex flex-col items-center">
                                    <img src={preview} alt="Preview" className="max-h-[400px] w-auto object-contain rounded-lg shadow-2xl mb-8 border border-slate-800" />
                                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                                        Change Image
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="w-24 h-24 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-xl">
                                        <Upload className="w-10 h-10 text-indigo-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-semibold text-white">Upload your photo</h3>
                                        <p className="text-slate-400 text-lg">Drag & drop or click to browse</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {preview && !stagedImage && (
                    <Card className="bg-slate-950 border-slate-800 shadow-xl">
                        <CardHeader><CardTitle className="text-white">Configuration</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none text-slate-300">Style</label>
                                    <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                                        <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            {styles.map((style) => (<SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none text-slate-300">Room Type</label>
                                    <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                                        <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            {roomTypes.map((type) => (<SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Optional User Prompt */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none text-slate-300">Additional Instructions (Optional)</label>
                                <Input placeholder="e.g. Make it feel like a Succession penthouse..." value={tweakPrompt} onChange={(e) => setTweakPrompt(e.target.value)} className="bg-slate-900 border-slate-700 text-white" />
                            </div>

                            <Button size="lg" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold" onClick={() => handleStage(false)} disabled={loading}>
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating & Verifying...</> : <><Sparkles className="mr-2 h-4 w-4" /> Stage Room (1 Credit)</>}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Results View */}
                {stagedImage && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-500">
                        {/* Original */}
                        <Card className="bg-slate-950 border-slate-800 h-full flex flex-col shadow-xl">
                            <CardHeader className="flex flex-row items-center space-y-0 min-h-[80px]">
                                <CardTitle className="text-slate-400">Original Room</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-black/40 rounded-lg mx-6 mb-6 border border-slate-800/50">
                                <img src={preview!} alt="Original" className="w-full h-auto rounded-md" />
                            </CardContent>
                            <CardFooter className="p-4 justify-center">
                                <Button variant="outline" onClick={() => { setStagedImage(null); setPreview(null); setProjectId(null); setTweakPrompt(""); }} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                                    Stage Another Room
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Staged */}
                        <Card className="bg-slate-950 border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.15)] h-full flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 min-h-[80px]">
                                <CardTitle className="text-indigo-400 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5" /> AI Staged (Verified)
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{selectedStyle}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-black/40 rounded-lg mx-6 border border-slate-800/50">
                                <img src={stagedImage} alt="Staged" className="w-full h-auto rounded-md" />
                            </CardContent>
                            <CardFooter className="flex-col gap-4 p-6">
                                {/* Download / Upscale Only - No More Edit */}
                                <Button className="w-full transition-all text-white font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/20" onClick={handleUpscaleAndDownload} disabled={loading} size="lg">
                                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><Download className="mr-2 h-4 w-4" /> Upscale to 4K & Download</>}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}
            </div>
            <CreditModal isOpen={showCreditModal} onClose={() => setShowCreditModal(false)} />
        </div>
    );
};
