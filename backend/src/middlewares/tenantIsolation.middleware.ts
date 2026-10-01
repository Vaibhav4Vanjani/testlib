import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles';
import { AuthorizationError, AuthenticationError } from '../utils/customErrors';

export const requireLibraryAccess = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new AuthenticationError());
    }

    // Super admin can operate on any tenant
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    if (!req.user.libraryId) {
      return next(new AuthorizationError('User is not associated with any active library tenant'));
    }

    const { User } = require('../models/user.model');
    const { Library } = require('../models/library.model');
    const { AdminProfile } = require('../models/adminProfile.model');

    const currentUser = await User.findById(req.user.userId);
    if (!currentUser || !currentUser.isActive) {
      return next(new AuthenticationError('User account is inactive. Access denied.'));
    }

    const targetLib = await Library.findById(req.user.libraryId);
    if (!targetLib || targetLib.isActive === false) {
      return next(new AuthenticationError('Library tenant is inactive. Access denied.'));
    }

    if (req.user.role === UserRole.STUDENT) {
      const adminProfile = await AdminProfile.findOne({ libraryId: req.user.libraryId });
      if (adminProfile?.userId) {
        const adminUser = await User.findById(adminProfile.userId);
        if (adminUser && !adminUser.isActive) {
          return next(new AuthenticationError('Library administration is currently inactive. Access denied.'));
        }
      }
    }

    const paramLibraryId = req.params.libraryId || req.query.libraryId || req.body.libraryId;
    if (paramLibraryId && paramLibraryId.toString() !== req.user.libraryId.toString()) {
      return next(new AuthorizationError('Cross-tenant access prohibited'));
    }

    next();
  } catch (err) {
    next(err);
  }
};

export const requireFeature = (featureName: 'enableReservedSeats' | 'enableLockers' | 'enableReferrals') => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role === UserRole.SUPER_ADMIN) {
        return next();
      }

      if (!req.user.libraryId) {
        return next(new AuthorizationError('User is not associated with any active library tenant'));
      }

      const { Library } = require('../models/library.model');
      const { ForbiddenError } = require('../utils/customErrors');
      const library = await Library.findById(req.user.libraryId).lean();

      if (!library) {
        return next(new AuthorizationError('Library tenant not found'));
      }

      const flags = library.featureFlags || {};
      if (flags[featureName] === false) {
        return next(new ForbiddenError(`This feature is disabled for your library tenant by Super Admin`));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
