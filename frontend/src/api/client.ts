import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

/** Every call is type-checked against contract/openapi.json (via the generated schema.d.ts). */
export const api = createClient<paths>();

export type Schemas = components["schemas"];

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The response data, or an ApiError carrying the backend's `detail` message. */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) throw new ApiError(response.status, detailOf(error));
  return data as T;
}

function detailOf(error: unknown): string {
  const detail = (error as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return detail;
  // FastAPI request validation: a list of {loc, msg}.
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join("; ");
  return "";
}
