export class DataError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message)
  }
}

export class ConflictError extends DataError {}

const SCHEMA_MISSING_CODES = new Set(["PGRST205", "42P01", "PGRST202"])

export function isSchemaMissing(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && SCHEMA_MISSING_CODES.has(error.code)
}

/** Converts a Supabase/PostgREST error into a DataError with a readable message. */
export function toDataError(error: { code?: string; message?: string; details?: string | null }): DataError {
  if (isSchemaMissing(error)) {
    return new DataError(
      "The database isn't set up yet. Run the SQL migration in Supabase (see the README), then reload.",
      "schema_missing",
    )
  }
  if (error.code === "PT409") return new ConflictError(error.message ?? "Conflict", "conflict", 409)
  if (error.code === "PT404") return new DataError(error.message ?? "Not found", "not_found", 404)
  if (error.code === "42501") return new DataError("You don't have access to this item.", "forbidden", 403)
  if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError")) {
    return new DataError("You appear to be offline. Changes will be saved when the connection returns.", "network")
  }
  return new DataError(error.message || "Unexpected database error", error.code)
}
