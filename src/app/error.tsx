"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ToolError({ reset }: { error: Error; reset: () => void }) {
    return (
        <main className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">This tool encountered an unexpected error. You can retry or return to the home page.</p>
            <div className="flex justify-center gap-2">
                <Button onClick={reset}>Try again</Button>
                <Button asChild variant="outline"><Link href="/">Home</Link></Button>
            </div>
        </main>
    );
}
