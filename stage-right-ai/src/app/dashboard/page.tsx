"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UploadZone } from "@/components/UploadZone";
import { Loader2, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Dashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    const [purchasing, setPurchasing] = useState(false);

    const handlePurchase = async (type: "pack" | "single") => {
        setPurchasing(true);
        try {
            const response = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, userId: user?.uid }),
            });
            const { url } = await response.json();
            if (url) {
                window.location.href = url;
            } else {
                throw new Error("No checkout URL returned");
            }
        } catch (error) {
            console.error("Purchase failed:", error);
            toast.error("Failed to initiate purchase.");
            setPurchasing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">
                    Welcome, <span className="text-indigo-400">{user.displayName || "Designer"}</span>
                </h1>
                <p className="text-slate-400">
                    Upload a photo to start staging your virtual room.
                </p>
            </div>

            {/* Purchase Credits Section */}
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                <button
                    onClick={() => handlePurchase("pack")}
                    disabled={purchasing}
                    className="relative group overflow-hidden rounded-xl bg-indigo-600 p-6 text-left transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                                Best Value
                            </span>
                            <span className="text-2xl font-bold text-white">$20</span>
                        </div>
                        <h3 className="text-lg font-bold text-white">Listing Pack</h3>
                        <p className="mt-1 text-indigo-100">5 Credits (3 edits each)</p>
                    </div>
                </button>

                <button
                    onClick={() => handlePurchase("single")}
                    disabled={purchasing}
                    className="relative group overflow-hidden rounded-xl bg-slate-900 border border-slate-800 p-6 text-left transition-all hover:border-indigo-500/50 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CreditCard className="w-24 h-24 text-slate-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400 border border-slate-700">
                                Pay As You Go
                            </span>
                            <span className="text-2xl font-bold text-white">$7</span>
                        </div>
                        <h3 className="text-lg font-bold text-white">Single Room</h3>
                        <p className="mt-1 text-slate-400">1 Credit (3 edits)</p>
                    </div>
                </button>
            </div>

            <UploadZone />
        </div>
    );
}
