export function createOriginGuard(allowedOrigins) {
  return (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next();
      return;
    }
    const origin = req.get('Origin');
    if (origin && !allowedOrigins.includes(origin)) {
      res.status(403).json({ success: false, error: 'Origin not allowed.' });
      return;
    }
    next();
  };
}
