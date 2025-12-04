import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Request logging middleware
 * Logs important requests in production, detailed logs in development
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  // Log request in development
  if (config.nodeEnv === 'development') {
    console.log(`${req.method} ${req.path}`, {
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
      ip: req.ip,
    });
  }

  // Log response time and status
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';

    if (config.nodeEnv === 'production') {
      // In production, only log errors and important endpoints
      if (res.statusCode >= 400 || req.path.includes('/auth') || req.path.includes('/payment')) {
        console.log(`[${logLevel.toUpperCase()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`, {
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
    } else {
      // In development, log everything
      console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
};

