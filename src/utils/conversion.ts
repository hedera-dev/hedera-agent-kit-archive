export const hexToUint8Array = (hex: string): Uint8Array => {
    // Remove '0x' prefix if present
    hex = hex.startsWith('0x') ? hex.slice(2) : hex;
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i/2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
};

export const uint8ArrayToHex = (bytes: Uint8Array): string => {
    return '0x' + Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}; 