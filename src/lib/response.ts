export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export function ok<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function fail(code: string, message: string, httpStatus = 400): { statusCode: number; body: ApiFailure } {
  return {
    statusCode: httpStatus,
    body: {
      ok: false,
      error: { code, message }
    }
  };
}