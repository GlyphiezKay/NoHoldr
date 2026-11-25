"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { parseCSV, type CSVData } from "@/lib/csv-utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Download } from "lucide-react";


export default function CSVViewerPage() {
    const [data, setData] = useState<CSVData | null>(null);
    const [filename, setFilename] = useState("");
    const [error, setError] = useState("");
    const [isDragging, setIsDragging] = useState(false);


    const handleFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            try { setData(parseCSV(text)); setError(""); } catch (err) { setData(null); setError(err instanceof Error ? err.message : "Invalid CSV"); }
            setFilename(file.name);
        };
        reader.onerror = () => setError("Could not read file.");
        reader.readAsText(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
            handleFile(file);
        }
    }, [handleFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleFile(e.target.files[0]);
    }, [handleFile]);

    const downloadJSON = () => {
        if (!data) return;
        const json = data.rows.map(row =>
            Object.fromEntries(data.headers.map((h, i) => [h, row[i] || ""]))
        );
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename.replace(".csv", ".json");
        a.click();
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link href="/data"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <h1 className="text-lg font-semibold">CSV Viewer</h1>
            </div>

            {error && <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}
            {!data ? (
                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("csv-input")?.click()}
                >
                    <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="csv-input" />
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm"><span className="font-medium">Drop CSV</span> <span className="text-muted-foreground">or tap</span></p>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium">{filename} • {data.rows.length} rows</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={downloadJSON}>
                                <Download className="h-3 w-3 mr-1" />Export JSON
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setData(null)}>Change</Button>
                        </div>
                    </div>

                    <div className="border rounded-xl overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    {data.headers.map((h, i) => (
                                        <th key={i} className="px-3 py-2 text-left font-medium border-b">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.slice(0, 100).map((row, i) => (
                                    <tr key={i} className="hover:bg-muted/30">
                                        {row.map((cell, j) => (
                                            <td key={j} className="px-3 py-2 border-b whitespace-nowrap">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {data.rows.length > 100 && (
                        <p className="text-xs text-muted-foreground mt-2">Showing first 100 rows</p>
                    )}
                </>
            )}

            <p className="text-xs text-muted-foreground text-center mt-6">Processed locally</p>
        </div>
    );
}
