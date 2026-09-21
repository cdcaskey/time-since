export class HttpError extends Error {
  statusCode: number;
  field?: string;

  constructor(statusCode: number, message: string, field?: string) {
    super(message);
    this.statusCode = statusCode;
    this.field = field;
  }
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message);
}

export function badRequest(message: string, field?: string): HttpError {
  return new HttpError(400, message, field);
}
