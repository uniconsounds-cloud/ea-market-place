'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProductGalleryProps {
    mainImage: string;
    additionalImages?: string[];
    productName: string;
}

export function ProductGallery({ mainImage, additionalImages = [], productName }: ProductGalleryProps) {
    // Combine all images into a single list, filtering out null/empty strings
    const allImages = [mainImage, ...additionalImages].filter(img => !!img);
    const [selectedImage, setSelectedImage] = useState(allImages[0] || mainImage);

    if (allImages.length === 0) {
        return (
            <div className="aspect-square bg-muted rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground">
                ไม่มีรูปภาพ
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Main Image View */}
            <div className="aspect-square bg-gradient-to-br from-gray-900 to-black rounded-xl border border-border/50 flex items-center justify-center relative overflow-hidden shadow-2xl group">
                <img
                    key={selectedImage}
                    src={selectedImage}
                    alt={productName}
                    className="absolute inset-0 w-full h-full object-cover opacity-90 transition-all duration-500 animate-in fade-in zoom-in-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
                <div className="flex flex-wrap gap-3">
                    {allImages.map((img, index) => (
                        <button
                            key={index}
                            onClick={() => setSelectedImage(img)}
                            className={cn(
                                "relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 active:scale-95",
                                selectedImage === img 
                                    ? "border-primary ring-2 ring-primary/20 shadow-lg" 
                                    : "border-transparent opacity-60 hover:opacity-100"
                            )}
                        >
                            <img 
                                src={img} 
                                alt={`${productName} thumbnail ${index + 1}`} 
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
