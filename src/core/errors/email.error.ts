export abstract class EmailError extends Error {
    abstract readonly code: string;
    abstract readonly retryable: boolean;

    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}
