import React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CreditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreditModal: React.FC<CreditModalProps> = ({ isOpen, onClose }) => {
    const router = useRouter();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 text-left align-middle shadow-2xl transition-all animate-in zoom-in-95 duration-200">
                <div className="absolute top-4 right-4">
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-indigo-500/20">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-white font-serif">
                        Out of Credits?
                    </h3>

                    <p className="text-slate-400 leading-relaxed">
                        You need 1 credit to stage this room. Top up your balance to continue transforming your listings.
                    </p>

                    <div className="w-full pt-4 space-y-3">
                        <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 text-lg shadow-xl shadow-indigo-500/10"
                            onClick={() => router.push("/credits")}
                        >
                            Get Credits
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full text-slate-400 hover:text-white"
                            onClick={onClose}
                        >
                            Maybe Later
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
