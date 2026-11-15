export class AppError extends Error {
  constructor(message, statusCode = 400, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    res.status(409).json({
      success: false,
      error: `That ${field} is already taken.`,
      code: 'DUPLICATE_KEY',
    });
    return;
  }

  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: 'An unexpected server error occurred. Please try again.',
  });
}
