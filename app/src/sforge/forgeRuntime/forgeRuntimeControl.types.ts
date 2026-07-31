/** Complete public control surface stored in the application-wide Forge registry. */
export interface ForgeRuntimeControlDomain {
    start(): Promise<void>;
    open(): void;
    destroy(): void;
}
