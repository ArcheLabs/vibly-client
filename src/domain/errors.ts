export const ErrorCode = {
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
  COORDINATOR_UNREACHABLE: "COORDINATOR_UNREACHABLE",
  UNAUTHORIZED: "UNAUTHORIZED",
  PRINCIPAL_NOT_CONFIGURED: "PRINCIPAL_NOT_CONFIGURED",
  AGENT_NOT_CONFIGURED: "AGENT_NOT_CONFIGURED",
  PROJECT_NOT_SELECTED: "PROJECT_NOT_SELECTED",
  RUNTIME_NOT_FOUND: "RUNTIME_NOT_FOUND",
  WORK_ORDER_NOT_FOUND: "WORK_ORDER_NOT_FOUND",
  WORK_ALREADY_CLAIMED: "WORK_ALREADY_CLAIMED",
  CONTEXT_MISSING: "CONTEXT_MISSING",
  CONTEXT_INVALID: "CONTEXT_INVALID",
  EXECUTION_FAILED: "EXECUTION_FAILED",
  SUBMISSION_FAILED: "SUBMISSION_FAILED",
  NEGOTIATION_NOT_FOUND: "NEGOTIATION_NOT_FOUND",
  REVIEW_NOT_FOUND: "REVIEW_NOT_FOUND",
  REWARD_NOT_FOUND: "REWARD_NOT_FOUND",
  LOCAL_DB_ERROR: "LOCAL_DB_ERROR",
  INVALID_CONFIG: "INVALID_CONFIG",
  INVALID_INPUT: "INVALID_INPUT",
  COORDINATOR_API_ERROR: "COORDINATOR_API_ERROR",
  RUNTIME_REGISTRATION_REQUIRED: "RUNTIME_REGISTRATION_REQUIRED",
  RISK_LEVEL_BLOCKED: "RISK_LEVEL_BLOCKED",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ClientError extends Error {
  readonly code: ErrorCodeValue;
  readonly hint?: string;

  constructor(code: ErrorCodeValue, message: string, hint?: string) {
    super(message);
    this.name = "ClientError";
    this.code = code;
    this.hint = hint;
  }

  static notConfigured(what: string, hint: string): ClientError {
    return new ClientError(
      ErrorCode.CONFIG_NOT_FOUND,
      `${what} is not configured.`,
      hint,
    );
  }
}

export class CoordinatorApiError extends Error {
  readonly status: number;
  readonly apiCode?: string;

  constructor(status: number, message: string, apiCode?: string) {
    super(message);
    this.name = "CoordinatorApiError";
    this.status = status;
    this.apiCode = apiCode;
  }
}
