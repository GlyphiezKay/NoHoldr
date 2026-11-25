export function encodeBase64Text(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

export function decodeBase64Bytes(input: string): Uint8Array<ArrayBuffer> {
    const data = input.trim();
    const match = /^data:[^,]*;base64,([\s\S]*)$/i.exec(data);
    const binary = atob(match ? match[1] : data);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export function decodeBase64Text(input: string): string {
    return new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Bytes(input));
}
