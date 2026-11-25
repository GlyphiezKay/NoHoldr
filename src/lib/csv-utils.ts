export interface CSVData {
    headers: string[];
    rows: string[][];
}

export function parseCSV(text: string): CSVData {
    text = text.replace(/^\uFEFF/, "");
    const records: string[][] = [];
    let row: string[] = [], field = "", quoted = false, closed = false;
    const pushField = () => { row.push(field); field = ""; closed = false; };
    const pushRow = () => { pushField(); records.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') { quoted = false; closed = true; }
            else field += c;
        } else if (c === ",") pushField();
        else if (c === "\r" || c === "\n") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            pushRow();
        } else if (c === '"' && !field && !closed) quoted = true;
        else {
            if (closed || c === '"') throw new Error("Invalid CSV quoting.");
            field += c;
        }
    }
    if (quoted) throw new Error("Unclosed quoted CSV field.");
    if (field || row.length || closed) pushRow();
    const [headers = [], ...rows] = records;
    if (new Set(headers).size !== headers.length) throw new Error("Duplicate CSV column names.");
    if (rows.some(r => r.length !== headers.length)) throw new Error("CSV rows have inconsistent column counts.");
    return { headers, rows };
}

export function csvToJSON(text: string): Record<string, string>[] {
    const { headers, rows } = parseCSV(text);
    return rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

export function jsonToCSV(value: unknown): string {
    if (!Array.isArray(value) || !value.length || value.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
        throw new Error("JSON must contain a non-empty array of objects.");
    }
    const rows = value as Record<string, unknown>[];
    const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
    if (!headers.length) throw new Error("JSON objects must contain at least one column.");
    const encode = (value: unknown) => {
        const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
        return !text || /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.map(encode).join(","), ...rows.map(row => headers.map(key => encode(Object.hasOwn(row, key) ? row[key] : "")).join(","))].join("\r\n");
}
