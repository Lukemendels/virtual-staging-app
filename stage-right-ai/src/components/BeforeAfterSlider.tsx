"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoveHorizontal } from "lucide-react";

interface BeforeAfterSliderProps {
    beforeImage: string;
    afterImage: string;
    beforeLabel?: string;
    afterLabel?: string;
}

export const BeforeAfterSlider = ({
    beforeImage,
    afterImage,
    beforeLabel = "Empty",
    afterLabel = "Staged",
}: BeforeAfterSliderProps) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMove = (event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const clientX =
            "touches" in event ? event.touches[0].clientX : (event as MouseEvent).clientX;

        const relativeX = clientX - containerRect.left;
        const percentage = Math.min(Math.max((relativeX / containerRect.width) * 100, 0), 100);

        setSliderPosition(percentage);
    };

    const handleMouseDown = () => setIsDragging(true);
    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            if (isDragging) {
                handleMove(e);
            }
        };

        const handleGlobalUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener("mousemove", handleGlobalMove);
            window.addEventListener("touchmove", handleGlobalMove);
            window.addEventListener("mouseup", handleGlobalUp);
            window.addEventListener("touchend", handleGlobalUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleGlobalMove);
            window.removeEventListener("touchmove", handleGlobalMove);
            window.removeEventListener("mouseup", handleGlobalUp);
            window.removeEventListener("touchend", handleGlobalUp);
        };
    }, [isDragging]);

    const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        // Allow clicking anywhere on the container to jump
        handleMove(e);
        setIsDragging(true);
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl border border-slate-800 bg-slate-900 select-none cursor-ew-resize group"
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
        >
            {/* Before Image (Background) */}
            <img
                src={beforeImage}
                alt="Before"
                className="absolute top-0 left-0 w-full h-full object-cover grayscale opacity-50"
            />
            <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-full pointer-events-none">
                {beforeLabel}
            </div>

            {/* After Image (Overlay) */}
            <div
                className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white/80 z-20"
                style={{ width: `${sliderPosition}%` }}
            >
                <img
                    src={afterImage}
                    alt="After"
                    className="absolute top-0 left-0 w-full h-full max-w-none object-cover"
                    style={{ width: `${containerRef.current?.offsetWidth || 100}px` }}
                // Note: In React, getting the exact pixel width for the inner image to match container can be tricky on resize.
                // Using 100vw or similar might work, but '100%' of container is best.
                // Actually, for the overlay image to align perfectly with the background, it needs to be the same size as the container.
                // We can use a trick: set width to 100% of the PARENT container, not the overlay div.
                // But CSS 'width: 100%' refers to the overlay div.
                // So we need to set it to the width of the main container.
                />
                {/* Fix for image sizing in overlay: 
             We can use `width: 100%` relative to the container if we use `width: calc(100% / (sliderPosition / 100))`? No.
             The standard way is to set the image width to the container's width.
             We can use a ref to update it, or just use `width: 100vw` (if full screen) or specific pixel width.
             Better: Use `width: ${100 / (sliderPosition/100)}%`? No.
             
             Let's use the style from the HTML: `width: 200%` was hardcoded in the example? 
             "style='width: 200%'" in the HTML example suggests the overlay was at 50%?
             
             Correct CSS approach:
             .slider-image { width: [containerWidth]px; max-width: none; }
         */}
                <ImageFixer containerRef={containerRef} src={afterImage} />

                <div className="absolute top-4 right-4 z-30 px-3 py-1 bg-indigo-600/90 border border-indigo-400/30 text-white text-xs font-bold uppercase tracking-wider rounded-full pointer-events-none">
                    {afterLabel}
                </div>
            </div>

            {/* Handle */}
            <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] ring-4 ring-indigo-500/20 pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
            >
                <MoveHorizontal className="w-5 h-5 text-indigo-600" />
            </div>
        </div>
    );
};

// Helper to keep the overlay image sized correctly
const ImageFixer = ({ containerRef, src }: { containerRef: React.RefObject<HTMLDivElement | null>, src: string }) => {
    const [width, setWidth] = useState("100%");

    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setWidth(`${containerRef.current.offsetWidth}px`);
            }
        };

        updateWidth();
        window.addEventListener("resize", updateWidth);
        return () => window.removeEventListener("resize", updateWidth);
    }, [containerRef]);

    return (
        <img
            src={src}
            className="absolute top-0 left-0 h-full max-w-none object-cover"
            style={{ width }}
            alt="After"
        />
    );
}
