"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Home, Plus, CreditCard, Loader2, Sparkles } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export const Navbar = () => {
    const { user, signInWithGoogle, logout } = useAuth();
    const router = useRouter();
    const [credits, setCredits] = useState<number | null>(null);
    const [loadingCredits, setLoadingCredits] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            setCredits(doc.data()?.credits || 0);
        });
        return () => unsub();
    }, [user]);

    const handleBuyMore = () => {
        router.push("/credits");
    };

    return (
        <nav className="border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 sticky top-0 z-50">
            <div className="container flex h-16 items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white hover:text-indigo-400 transition-colors font-serif">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <Home className="text-white w-5 h-5" />
                    </div>
                    <span>ListingFlow</span>
                </Link>

                <div className="flex items-center gap-4">
                    {user ? (
                        <div className="flex items-center gap-4">
                            {credits !== null && (
                                <div className="hidden md:flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
                                    <span className="text-sm font-medium text-slate-400">
                                        {credits} {credits === 1 ? "Credit" : "Credits"}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20"
                                        onClick={() => router.push("/credits")}
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Buy More
                                    </Button>
                                </div>
                            )}

                            <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
                                {user.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt="User Avatar"
                                        className="h-8 w-8 rounded-full border border-slate-700"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/30">
                                        {user.email?.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => logout()}>
                                    Sign Out
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button onClick={() => signInWithGoogle()} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                            Sign In
                        </Button>
                    )}
                </div>
            </div>
        </nav>
    );
};
