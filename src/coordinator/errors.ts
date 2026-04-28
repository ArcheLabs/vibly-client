export class CoordinatorApiError extends Error {
  readonly status: number;
  readonly apiCode?: string;

  constructor(status: number, message: string, apiCode?: string) {
    super(message);
    this.name = "CoordinatorApiError";
    this.status = status;
    this.apiCode = apiCode;
  }

  isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }
}
