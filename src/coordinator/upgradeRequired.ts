import { getLogger } from "../config/logger.js";

interface CoordinatorErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      received?: unknown;
    };
  };
}

export async function logUpgradeRequiredResponse(response: Response): Promise<void> {
  if (response.status !== 426) return;
  const body = await readJsonBody(response.clone());
  const error = body?.error;
  getLogger().error(
    {
      coordinatorError: {
        code: error?.code,
        message: error?.message,
        details: { received: error?.details?.received },
      },
    },
    "coordinator: upgrade required",
  );
}

export async function coordinatorErrorFromResponse(response: Response, fallbackMessage: string): Promise<{ message: string; code?: string }> {
  const body = await readJsonBody(response.clone());
  const error = body?.error;
  if (error?.message || error?.code) {
    return { message: error.message ?? fallbackMessage, code: error.code };
  }
  const text = await response.text().catch(() => "");
  return { message: text || fallbackMessage };
}

async function readJsonBody(response: Response): Promise<CoordinatorErrorBody | undefined> {
  try {
    const json = await response.json() as unknown;
    return json && typeof json === "object" ? json as CoordinatorErrorBody : undefined;
  } catch {
    return undefined;
  }
}
