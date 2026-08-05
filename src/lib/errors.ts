/**
 * Application error taxonomy.
 *
 * Server Actions convert these into typed results for the form layer; route
 * handlers convert them into HTTP status codes. Anything not in this list is
 * an unexpected fault and is reported to the user as a generic failure while
 * the detail goes to the server log.
 */

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SUBMISSION_CLOSED"
  | "INVALID_STATE"
  | "UPLOAD_REJECTED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SUBMISSION_CLOSED: 403,
  INVALID_STATE: 409,
  UPLOAD_REJECTED: 415,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Field-scoped messages, keyed by form path. */
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { fieldErrors?: Record<string, string[]>; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export const unauthenticated = (message = "You need to sign in to continue.") =>
  new AppError("UNAUTHENTICATED", message);

export const forbidden = (message = "You do not have permission to do that.") =>
  new AppError("FORBIDDEN", message);

export const notFound = (message = "We could not find what you were looking for.") =>
  new AppError("NOT_FOUND", message);

export const conflict = (message: string, fieldErrors?: Record<string, string[]>) =>
  new AppError("CONFLICT", message, { fieldErrors });

export const invalidState = (message: string) => new AppError("INVALID_STATE", message);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * The uniform shape every Server Action returns. A discriminated union means
 * the client cannot read `data` without first proving the call succeeded.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: AppErrorCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export function actionOk(): ActionResult<undefined>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function actionError(error: unknown): ActionResult<never> {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
    };
  }

  // Never leak an internal message to the browser.
  console.error("[action] unhandled error", error);
  return {
    ok: false,
    code: "INTERNAL",
    message: "Something went wrong on our side. Please try again.",
  };
}
