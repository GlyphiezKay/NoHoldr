"use client";

import { ToolWorkspace } from "@/components/layout/tool-workspace";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, ArrowRightLeft, Clock } from "lucide-react";

const CopyRow = ({ label, value, copiedValue, onCopy }: { label: string; value: string; copiedValue: string | null; onCopy: (value: string) => void }) => (
    <div className="flex flex-wrap items-center justify-between gap-1 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
        <span className="text-xs text-muted-foreground">{label}</span>
        <button onClick={() => onCopy(value)} className="flex min-w-0 items-center gap-1.5 wrap-anywhere text-left font-mono text-xs">
            {value}
            {copiedValue === value ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
        </button>
    </div>
);

export default function TimestampPage() {
    const [epochUnit, setEpochUnit] = useState("auto");
    const [epoch, setEpoch] = useState("");
    const [dateStr, setDateStr] = useState("");
    const [now, setNow] = useState<number | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    // Live clock
    useEffect(() => {
        const update = () => setNow(Date.now());
        const initial = setTimeout(update, 0);
        const timer = setInterval(update, 1000);
        return () => {
            clearTimeout(initial);
            clearInterval(timer);
        };
    }, []);

    const unixNow = now === null ? null : Math.floor(now / 1000);
    const currentDate = now === null ? null : new Date(now);
    const today = now === null ? null : Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000);

    const epochToDate = (val: string) => {
        if (!/^[+-]?\d+$/.test(val.trim())) return null;
        const num = Number(val);
        if (!Number.isSafeInteger(num)) return null;
        const seconds = epochUnit === "seconds" || (epochUnit === "auto" && Math.abs(num) < 1e12);
        const date = new Date(seconds ? num * 1000 : num);
        return Number.isFinite(date.getTime()) ? date : null;
    };

    const dateToEpoch = (val: string) => {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d;
    };

    const parsedFromEpoch = epoch ? epochToDate(epoch) : null;
    const parsedFromDate = dateStr ? dateToEpoch(dateStr) : null;

    const formatFull = (d: Date) => ({
        utc: d.toUTCString(),
        iso: d.toISOString(),
        local: d.toLocaleString(),
        relative: getRelative(d),
        unix: Math.floor(d.getTime() / 1000),
        unixMs: d.getTime(),
    });

    const getRelative = (d: Date): string => {
        if (now === null) return "—";
        const diff = now - d.getTime();
        const abs = Math.abs(diff);
        const suffix = diff > 0 ? "ago" : "from now";

        if (abs < 60000) return `${Math.floor(abs / 1000)} seconds ${suffix}`;
        if (abs < 3600000) return `${Math.floor(abs / 60000)} minutes ${suffix}`;
        if (abs < 86400000) return `${Math.floor(abs / 3600000)} hours ${suffix}`;
        if (abs < 2592000000) return `${Math.floor(abs / 86400000)} days ${suffix}`;
        if (abs < 31536000000) return `${Math.floor(abs / 2592000000)} months ${suffix}`;
        return `${Math.floor(abs / 31536000000)} years ${suffix}`;
    };

    const copyValue = async (value: string) => {
        await navigator.clipboard.writeText(value);
        setCopied(value);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <ToolWorkspace category="Data tools" backHref="/data" title="Timestamp Converter" description="Convert calendar dates and Unix timestamps.">
            <div className="utility-body mx-auto w-full max-w-2xl min-w-0 rounded-2xl border bg-card p-4 sm:p-5">

            {/* Live clock */}
            <div className="border rounded-xl p-4 mb-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-sm font-medium">Current Time</span>
                </div>
                <p className="font-mono text-2xl font-bold">{unixNow ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">{currentDate?.toISOString() ?? "—"}</p>
                <Button variant="ghost" size="sm" className="mt-2" disabled={unixNow === null} onClick={() => unixNow !== null && copyValue(String(unixNow))}>
                    <Copy className="h-3 w-3 mr-1" />Copy Unix
                </Button>
            </div>

            {/* Epoch → Date */}
            <div className="border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />Epoch → Human Date
                </h3>
                <Input
                    aria-label="Unix timestamp" value={epoch}
                    onChange={(e) => setEpoch(e.target.value)}
                    placeholder="e.g. 1700000000 or 1700000000000"
                    className="font-mono mb-3"
                />

                <label className="mb-3 block text-sm">Input unit
                    <select className="ml-2 rounded-lg border bg-background p-1" value={epochUnit} onChange={event => setEpochUnit(event.target.value)}>
                        <option value="auto">Auto</option><option value="seconds">Seconds</option><option value="milliseconds">Milliseconds</option>
                    </select>
                </label>
                {epoch.trim() && !parsedFromEpoch && <p role="alert" className="mb-2 text-sm text-destructive">Enter a valid Unix timestamp.</p>}
                {parsedFromEpoch && !isNaN(parsedFromEpoch.getTime()) && (
                    <div className="border rounded-lg overflow-hidden">
                        {(() => {
                            const f = formatFull(parsedFromEpoch);
                            return (
                                <>
                                    <CopyRow label="UTC" value={f.utc} copiedValue={copied} onCopy={copyValue} />
                                    <CopyRow label="ISO 8601" value={f.iso} copiedValue={copied} onCopy={copyValue} />
                                    <CopyRow label="Local" value={f.local} copiedValue={copied} onCopy={copyValue} />
                                    <CopyRow label="Relative" value={f.relative} copiedValue={copied} onCopy={copyValue} />
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Date → Epoch */}
            <div className="border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />Human Date → Epoch
                </h3>
                <Input
                    type="datetime-local"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="mb-3"
                />

                {parsedFromDate && !isNaN(parsedFromDate.getTime()) && (
                    <div className="border rounded-lg overflow-hidden">
                        {(() => {
                            const f = formatFull(parsedFromDate);
                            return (
                                <>
                                    <CopyRow label="Unix (seconds)" value={f.unix.toString()} copiedValue={copied} onCopy={copyValue} />
                                    <CopyRow label="Unix (ms)" value={f.unixMs.toString()} copiedValue={copied} onCopy={copyValue} />
                                    <CopyRow label="ISO 8601" value={f.iso} copiedValue={copied} onCopy={copyValue} />
                                    <CopyRow label="Relative" value={f.relative} copiedValue={copied} onCopy={copyValue} />
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Common timestamps */}
            <div className="border rounded-xl p-4">
                <h3 className="text-sm font-medium mb-2">Quick Reference</h3>
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Start of today</span>
                        <button disabled={today === null} onClick={() => today !== null && setEpoch(String(today))} className="font-mono hover:text-foreground">
                            {today ?? "—"}
                        </button>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>1 hour ago</span>
                        <button disabled={unixNow === null} onClick={() => unixNow !== null && setEpoch(String(unixNow - 3600))} className="font-mono hover:text-foreground">
                            {unixNow === null ? "—" : unixNow - 3600}
                        </button>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>24 hours ago</span>
                        <button disabled={unixNow === null} onClick={() => unixNow !== null && setEpoch(String(unixNow - 86400))} className="font-mono hover:text-foreground">
                            {unixNow === null ? "—" : unixNow - 86400}
                        </button>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Unix epoch (Y2K38)</span>
                        <button onClick={() => setEpoch("2147483647")} className="font-mono hover:text-foreground">
                            2147483647
                        </button>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6">All conversions happen locally</p>
            </div>
        </ToolWorkspace>
    );
}
