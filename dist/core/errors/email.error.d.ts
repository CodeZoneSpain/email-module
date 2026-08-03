export declare abstract class EmailError extends Error {
    abstract readonly code: string;
    abstract readonly retryable: boolean;
    constructor(message: string);
}
