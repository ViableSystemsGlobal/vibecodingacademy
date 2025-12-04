import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';

export const requireParent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required' },
    });
  }

  if (req.user.role !== UserRole.PARENT) {
    return res.status(403).json({
      success: false,
      error: { message: 'Parent access required' },
    });
  }

  // Verify parent record exists
  const parent = await prisma.parent.findUnique({
    where: { userId: req.user.id },
  });

  if (!parent) {
    return res.status(404).json({
      success: false,
      error: { message: 'Parent record not found' },
    });
  }

  // Add parentId to request for easy access
  (req as any).parentId = parent.id;
  next();
};

