export interface MathLinksMetadata {
    "mathLink"?: string;
    "mathLink-blocks"?: Record<string, string>
}

export interface MathLinksAPIAccount {
	update(path: string, newMetadata: MathLinksMetadata): void;
    get(path: string, blockID?: string): string | undefined; 
    delete(path: string, which?: string): void;
    deleteAccount(): void;
}
