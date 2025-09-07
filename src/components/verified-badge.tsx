
"use client";

import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
    className?: string;
}

export function VerifiedBadge({ className }: VerifiedBadgeProps) {
    return (
        <div className={cn("flex items-center gap-1 text-blue-500", className)}>
            <ShieldCheck className="h-4 w-4" />
        </div>
    );
}
