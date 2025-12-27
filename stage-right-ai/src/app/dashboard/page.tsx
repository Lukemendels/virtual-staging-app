"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UploadZone } from "@/components/UploadZone";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [isPaid, setIsPaid] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    // Check for payment success on mount
    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get("payment") === "success") {
            setIsPaid(true);
            toast.success("Payment successful! Credits added to your account.");

            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="container mx-auto px-4 py-8 space-y-8 min-h-screen">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-white font-serif">
                    Welcome, {user.displayName}
                </h1>
                <p className="text-slate-400">
                    Upload a photo to start staging your virtual room.
                </p>
            </div>

            <UploadZone />
        </div>
    );
}
