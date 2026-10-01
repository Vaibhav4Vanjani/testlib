import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { StudentProfile } from '../models/studentProfile.model';
import { AdminProfile } from '../models/adminProfile.model';
import { RefreshToken } from '../models/refreshToken.model';
import { CryptoUtils } from '../utils/crypto';
import { AuthenticationError, NotFoundError } from '../utils/customErrors';
import { env } from '../config/env';
import { UserRole } from '../constants/roles';
import { MembershipStatus } from '../constants/statusEnums';
import { logger } from '../config/logger';

export class AuthService {
  static async login(identifier: string, password: string, selectedLibraryId?: string) {
    const cleanId = (identifier || '').trim();

    // Find all users matching phone or email
    const matchingUsers = await User.find({
      $or: [
        { phone: cleanId },
        { email: cleanId.toLowerCase() },
      ],
    });

    if (!matchingUsers || matchingUsers.length === 0) {
      throw new AuthenticationError('Invalid phone number/email or password');
    }

    // Check if any matching user is non-student (e.g. LIBRARY_ADMIN or SUPER_ADMIN)
    const adminUser = matchingUsers.find((u) => u.role === UserRole.LIBRARY_ADMIN || u.role === UserRole.SUPER_ADMIN);
    if (adminUser) {
      if (!adminUser.isActive) {
        throw new AuthenticationError('Your account has been set to inactive. Please contact system administration.');
      }

      const isMatch = await CryptoUtils.comparePassword(password, adminUser.passwordHash);
      if (!isMatch) {
        throw new AuthenticationError('Invalid phone number/email or password');
      }

      let libraryId: string | undefined;
      if (adminUser.role === UserRole.LIBRARY_ADMIN) {
        const adminProfile = await AdminProfile.findOne({ userId: adminUser._id });
        if (adminProfile?.libraryId) {
          libraryId = adminProfile.libraryId.toString();
          const { Library } = require('../models/library.model');
          const library = await Library.findById(libraryId);
          if (library && !library.isActive) {
            throw new AuthenticationError('Your library account is inactive. Please contact Super Admin.');
          }
        }
      }

      const tokenPayload = {
        userId: adminUser._id.toString(),
        role: adminUser.role,
        libraryId,
        phone: adminUser.phone,
      };

      const accessToken = CryptoUtils.generateAccessToken(tokenPayload);
      const family = CryptoUtils.generateNonce();
      const refreshToken = CryptoUtils.generateRefreshToken({ userId: adminUser._id.toString(), family });
      const tokenHash = CryptoUtils.hashToken(refreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await RefreshToken.create({ userId: adminUser._id, tokenHash, family, expiresAt });

      return {
        accessToken,
        refreshToken,
        user: {
          id: adminUser._id.toString(),
          fullName: adminUser.fullName,
          email: adminUser.email,
          phone: adminUser.phone,
          role: adminUser.role,
          libraryId,
        },
      };
    }

    // Process Student Login across multiple library profiles
    const userIds = matchingUsers.map((u) => u._id);
    const { Library } = require('../models/library.model');
    const allStudentProfiles = await StudentProfile.find({ userId: { $in: userIds } })
      .populate('libraryId', 'name city code isActive')
      .populate('userId')
      .sort({ createdAt: -1 })
      .lean();

    if (!allStudentProfiles || allStudentProfiles.length === 0) {
      throw new NotFoundError('Student profile not found');
    }

    // Verify credentials for each candidate profile
    const validCandidateProfiles: any[] = [];
    for (const profile of allStudentProfiles) {
      const u = profile.userId as any;
      if (!u || !u.isActive) continue;

      const targetHash = profile.passwordHash || u.passwordHash;
      const isMatch = await CryptoUtils.comparePassword(password, targetHash);
      if (!isMatch) continue;

      // Check student status
      if (profile.membershipStatus === MembershipStatus.INACTIVE) continue;

      // Check library status
      const lib = profile.libraryId as any;
      if (!lib || lib.isActive === false) continue;

      validCandidateProfiles.push(profile);
    }

    if (validCandidateProfiles.length === 0) {
      throw new AuthenticationError('Invalid phone number/email or password, or your library membership is currently inactive.');
    }

    // If explicit library selected or only 1 valid profile exists
    let chosenProfile = validCandidateProfiles[0];
    if (selectedLibraryId) {
      const matched = validCandidateProfiles.find((p) => p.libraryId?._id?.toString() === selectedLibraryId.toString());
      if (!matched) {
        throw new AuthenticationError('Selected library profile is invalid or inactive for your account.');
      }
      chosenProfile = matched;
    } else if (validCandidateProfiles.length > 1) {
      // Prompt user to select target library
      return {
        requiresLibrarySelection: true,
        availableLibraries: validCandidateProfiles.map((p) => ({
          libraryId: p.libraryId._id.toString(),
          libraryName: p.libraryId.name,
          city: p.libraryId.city || '',
          code: p.libraryId.code || '',
          membershipStatus: p.membershipStatus,
          expiresAt: p.membershipExpiresAt,
          studentProfileId: p._id.toString(),
        })),
      };
    }

    const studentUser = chosenProfile.userId as any;
    const targetLibraryId = chosenProfile.libraryId._id.toString();
    const targetStudentProfileId = chosenProfile._id.toString();

    const tokenPayload = {
      userId: studentUser._id.toString(),
      role: UserRole.STUDENT,
      libraryId: targetLibraryId,
      studentProfileId: targetStudentProfileId,
      phone: studentUser.phone,
    };

    const accessToken = CryptoUtils.generateAccessToken(tokenPayload);
    const family = CryptoUtils.generateNonce();
    const refreshToken = CryptoUtils.generateRefreshToken({ userId: studentUser._id.toString(), family });
    const tokenHash = CryptoUtils.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({ userId: studentUser._id, tokenHash, family, expiresAt });

    return {
      accessToken,
      refreshToken,
      user: {
        id: studentUser._id.toString(),
        fullName: studentUser.fullName,
        phone: studentUser.phone,
        email: studentUser.email,
        role: UserRole.STUDENT,
        libraryId: targetLibraryId,
        studentProfileId: targetStudentProfileId,
      },
    };
  }

  static async refreshToken(refreshToken: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    const tokenHash = CryptoUtils.hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash });

    if (!storedToken || storedToken.isRevoked) {
      if (storedToken && storedToken.isRevoked) {
        // Grace period check (10s): allow concurrent refresh requests from same client/session
        const timeSinceRevoked = Date.now() - new Date(storedToken.createdAt).getTime();
        if (timeSinceRevoked < 10000) {
          const latestActiveToken = await RefreshToken.findOne({
            family: storedToken.family,
            isRevoked: false,
          }).sort({ createdAt: -1 });

          if (latestActiveToken) {
            const user = await User.findById(decoded.userId);
            if (user && user.isActive) {
              let libraryId: string | undefined;
              let studentProfileId: string | undefined;

              if (user.role === UserRole.STUDENT) {
                const sp = await StudentProfile.findOne({ userId: user._id }).sort({ createdAt: -1 });
                if (sp) {
                  libraryId = sp.libraryId.toString();
                  studentProfileId = sp._id.toString();
                }
              } else if (user.role === UserRole.LIBRARY_ADMIN) {
                const ap = await AdminProfile.findOne({ userId: user._id });
                if (ap?.libraryId) libraryId = ap.libraryId.toString();
              }

              const newAccessToken = CryptoUtils.generateAccessToken({
                userId: user._id.toString(),
                role: user.role,
                libraryId,
                studentProfileId,
                phone: user.phone,
              });

              return {
                accessToken: newAccessToken,
                refreshToken,
              };
            }
          }
        }

        // Security breach: Token family reuse attack detected outside grace period
        await RefreshToken.updateMany({ family: storedToken.family }, { isRevoked: true });
      }
      throw new AuthenticationError('Invalid refresh token session. Please log in again.');
    }

    // Revoke old token
    storedToken.isRevoked = true;
    await storedToken.save();

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User account inactive or not found');
    }

    let libraryId: string | undefined;
    let studentProfileId: string | undefined;

    if (user.role === UserRole.STUDENT) {
      const studentProfile = await StudentProfile.findOne({ userId: user._id }).sort({ createdAt: -1 });
      if (studentProfile) {
        if (studentProfile.membershipStatus === MembershipStatus.INACTIVE) {
          throw new AuthenticationError('Your account has been deactivated. Please contact your Local Library Admin for reactivation.');
        }
        libraryId = studentProfile.libraryId.toString();
        studentProfileId = studentProfile._id.toString();

        const { Library } = require('../models/library.model');
        const library = await Library.findById(libraryId);
        const adminProfile = await AdminProfile.findOne({ libraryId });
        let adminIsActive = true;
        if (adminProfile?.userId) {
          const adminUser = await User.findById(adminProfile.userId);
          if (adminUser && !adminUser.isActive) {
            adminIsActive = false;
          }
        }

        if (library?.isActive === false || !adminIsActive) {
          throw new AuthenticationError('Your library subscription is currently inactive. Please contact your library administration.');
        }
      }
    } else if (user.role === UserRole.LIBRARY_ADMIN) {
      const adminProfile = await AdminProfile.findOne({ userId: user._id });
      if (adminProfile?.libraryId) {
        libraryId = adminProfile.libraryId.toString();
        const { Library } = require('../models/library.model');
        const library = await Library.findById(libraryId);
        if (library && !library.isActive) {
          throw new AuthenticationError('Your library account is inactive. Please contact Super Admin.');
        }
      }
    }

    const tokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      libraryId,
      studentProfileId,
      phone: user.phone,
    };

    const newAccessToken = CryptoUtils.generateAccessToken(tokenPayload);
    let newRefreshToken = CryptoUtils.generateRefreshToken({ userId: user._id.toString(), family: storedToken.family });
    let newTokenHash = CryptoUtils.hashToken(newRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      await RefreshToken.create({
        userId: user._id,
        tokenHash: newTokenHash,
        family: storedToken.family,
        expiresAt,
      });
    } catch (err: any) {
      if (err.code === 11000 || err.name === 'MongoServerError') {
        logger.warn(`[AuthService] E11000 duplicate tokenHash caught. Regenerating unique refresh token.`);
        newRefreshToken = CryptoUtils.generateRefreshToken({ userId: user._id.toString(), family: storedToken.family });
        newTokenHash = CryptoUtils.hashToken(newRefreshToken);
        await RefreshToken.create({
          userId: user._id,
          tokenHash: newTokenHash,
          family: storedToken.family,
          expiresAt,
        });
      } else {
        throw err;
      }
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    const tokenHash = CryptoUtils.hashToken(refreshToken);
    await RefreshToken.updateOne({ tokenHash }, { isRevoked: true });
  }

  static async getCurrentUser(userId: string): Promise<any> {
    const user = await User.findById(userId).select('-passwordHash').lean();
    if (!user) {
      throw new NotFoundError('User not found');
    }

    let studentProfile = null;
    let adminProfile = null;

    if (user.role === UserRole.STUDENT) {
      studentProfile = await StudentProfile.findOne({ userId: user._id })
        .sort({ createdAt: -1 })
        .populate('libraryId', 'name code status openingTime closingTime announcement')
        .lean();
    } else if (user.role === UserRole.LIBRARY_ADMIN) {
      adminProfile = await AdminProfile.findOne({ userId: user._id }).populate('libraryId', 'name code status openingTime closingTime announcement').lean();
    }

    return {
      ...user,
      studentProfile,
      adminProfile,
    };
  }
}
