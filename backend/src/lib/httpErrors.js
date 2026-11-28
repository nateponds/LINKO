const PG_CLIENT_ERRORS = {
  "23505": [400, "A conflicting record already exists."],
  "23503": [400, "Referenced record does not exist."],
  "23514": [400, "Request violates a data constraint."],
  "22P02": [400, "Invalid identifier or input format."],
};

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function asClientError(error) {
  if (error?.statusCode) {
    return error;
  }
  const mapped = error?.code ? PG_CLIENT_ERRORS[error.code] : undefined;
  if (mapped) {
    return createHttpError(mapped[0], mapped[1]);
  }
  return error;
}

export function readSingletonQueryString(value, fieldName) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw createHttpError(400, `${fieldName} must be a single string`);
  }
  return value;
}
