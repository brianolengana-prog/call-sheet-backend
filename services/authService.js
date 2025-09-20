/**
 * Authentication Service
 * Unified authentication service for the backend
 */

const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const crypto = require('crypto');
const emailService = require('./emailService');
const securityService = require('./securityService');
const prismaService = require('./prismaService');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    
    // Database storage - all data persisted in Supabase
    // No in-memory storage needed
    
    // Initialize with demo user for development
    this.initializeDemoUser();
    
    // Google OAuth configuration
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/callback`
    );
  }

  /**
   * Initialize demo user for development
   */
  async initializeDemoUser() {
    if (process.env.NODE_ENV !== 'production') {
      const demoEmail = 'demo@example.com';
      const demoPassword = 'demo123';
      
      try {
        // Check if demo user already exists
        const existingUser = await prismaService.getUserByEmail(demoEmail);
        
        if (!existingUser) {
          const hashedPassword = await securityService.hashPassword(demoPassword);
          
          const demoUser = {
            name: 'Demo User',
            email: demoEmail,
            passwordHash: hashedPassword,
            provider: 'email',
            emailVerified: true,
            twoFactorEnabled: false
          };
          
          const createdUser = await prismaService.createUser(demoUser);
          console.log('🔧 Demo user created:', demoEmail, 'ID:', createdUser.id);
        } else {
          console.log('🔧 Demo user already exists:', demoEmail);
        }
      } catch (error) {
        console.error('Error initializing demo user:', error);
      }
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(payload) {
    // Remove exp from payload if it exists to avoid conflict with expiresIn
    const { exp, ...cleanPayload } = payload;
    
    return jwt.sign(cleanPayload, this.jwtSecret, { 
      expiresIn: this.jwtExpiry,
      issuer: 'call-sheet-backend',
      audience: 'call-sheet-frontend'
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate UUID from Google ID (deterministic)
   */
  generateUUIDFromGoogleId(googleId) {
    const hash = googleId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const positiveHash = Math.abs(hash);
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (positiveHash + Math.random() * 16) % 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    return uuid;
  }

  /**
   * Create user object from Google OAuth data
   */
  createUserFromGoogle(userInfo) {
    const generatedUUID = this.generateUUIDFromGoogleId(userInfo.id);
    
    return {
      id: generatedUUID,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      emailVerified: userInfo.verified_email || false,
      provider: 'google',
      googleId: userInfo.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Create authentication session
   */
  createSession(user) {
    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours
    
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      provider: user.provider,
      iat: Math.floor(now / 1000),
      exp: Math.floor(expiresAt / 1000)
    };

    const accessToken = this.generateToken(tokenPayload);
    const refreshToken = this.generateRefreshToken();

    return {
      user,
      accessToken,
      refreshToken,
      expiresAt,
      isActive: true
    };
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code) {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user info from Google
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();

      if (!userInfo.email) {
        throw new Error('No email found in Google user info');
      }

      // Check if user exists in database
      let user = await prismaService.getUserByProvider('google', userInfo.id);
      
      if (!user) {
        // Create new user in database
        const userData = {
          name: userInfo.name,
          email: userInfo.email,
          provider: 'google',
          providerId: userInfo.id,
          emailVerified: userInfo.verified_email || false,
          twoFactorEnabled: false
          // Note: id will be auto-generated by Prisma as UUID
        };
        
        user = await prismaService.createUser(userData);
        
        // Log user registration
        await prismaService.logSecurityEvent({
          userId: user.id,
          action: 'user_registered',
          success: true,
          details: { email: user.email, provider: 'google' }
        });
      } else {
        // Update last login
        await prismaService.updateUser(user.id, { lastLoginAt: new Date() });
      }
      
      // Create session
      const session = this.createSession(user);

      // Log successful login
      await prismaService.logSecurityEvent({
        userId: user.id,
        action: 'login_success',
        success: true,
        details: { email: user.email, provider: 'google' }
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          provider: user.provider,
          twoFactorEnabled: user.twoFactorEnabled,
          createdAt: user.createdAt
        },
        session
      };
    } catch (error) {
      console.error('Google OAuth error:', error);
      return {
        success: false,
        error: error.message || 'Google OAuth failed'
      };
    }
  }

  /**
   * Verify access token and get user info
   */
  async verifyAccessToken(token) {
    try {
      const decoded = this.verifyToken(token);
      
      // In a real implementation, you would:
      // 1. Check if the user still exists in your database
      // 2. Verify the user is still active
      // 3. Check if the token hasn't been revoked
      
      // For now, we'll create a minimal user object from the token
      const user = {
        id: decoded.userId,
        email: decoded.email,
        provider: decoded.provider,
        emailVerified: true, // Assume verified for JWT tokens
        name: decoded.name || decoded.email.split('@')[0],
        picture: decoded.picture,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return {
        success: true,
        user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Token verification failed'
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      // In a real implementation, you would:
      // 1. Verify the refresh token exists in your database
      // 2. Check if it hasn't expired
      // 3. Generate a new access token
      // 4. Optionally rotate the refresh token
      
      // For now, we'll just generate a new token
      // In production, you'd look up the user from the refresh token
      throw new Error('Refresh token functionality not implemented');
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Token refresh failed'
      };
    }
  }

  /**
   * Register new user
   */
  async registerUser(userData) {
    try {
      const { name, email, password } = userData;

      // Validate input
      if (!securityService.validateEmail(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const passwordValidation = securityService.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.errors.join(', ') };
      }

      // Check if user already exists
      const existingUser = await prismaService.getUserByEmail(email);
      console.log('🔍 Checking for existing user:', email);
      console.log('🔍 Existing user result:', existingUser);
      if (existingUser) {
        console.log('❌ User already exists:', existingUser.email);
        return { success: false, error: 'User already exists' };
      }
      console.log('✅ User does not exist, proceeding with registration');

      // Hash password
      const hashedPassword = await securityService.hashPassword(password);
      
      // Create user in database
      const newUserData = {
        name,
        email,
        passwordHash: hashedPassword,
        provider: 'email',
        emailVerified: false,
        twoFactorEnabled: false
      };

      const user = await prismaService.createUser(newUserData);
      
      // Generate verification token
      const verificationToken = securityService.generateEmailVerificationToken();
      
      // Store verification token in database
      await prismaService.createEmailVerificationToken(
        user.id,
        verificationToken.token,
        verificationToken.expiresAt
      );

      // Send verification email
      await emailService.sendVerificationEmail(email, verificationToken.token, name);

      // Log security event
      await prismaService.logSecurityEvent({
        userId: user.id,
        action: 'user_registered',
        success: true,
        details: { email, name, provider: 'email' }
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          provider: user.provider,
          createdAt: user.createdAt
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  /**
   * Login with email and password
   */
  async loginWithPassword(email, password, ip, userAgent) {
    try {
      // Check if account is locked
      if (securityService.isAccountLocked(email)) {
        return {
          success: false,
          error: 'Account is temporarily locked due to too many failed attempts'
        };
      }

      // Get user from database
      const user = await prismaService.getUserByEmail(email);
      console.log('🔍 User lookup for email:', email);
      console.log('🔍 User found:', !!user);
      
      if (!user) {
        await prismaService.logSecurityEvent({
          action: 'failed_login',
          success: false,
          details: { email, reason: 'user_not_found' },
          ipAddress: ip,
          userAgent: userAgent
        });
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Verify password
      const isValidPassword = await securityService.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        await prismaService.logSecurityEvent({
          userId: user.id,
          action: 'failed_login',
          success: false,
          details: { email, reason: 'invalid_password' },
          ipAddress: ip,
          userAgent: userAgent
        });
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Check if email is verified (skip in development)
      if (!user.emailVerified && process.env.NODE_ENV === 'production') {
        return {
          success: false,
          error: 'Please verify your email address before logging in',
          requiresVerification: true
        };
      }

      // Auto-verify email in development mode
      if (!user.emailVerified && process.env.NODE_ENV !== 'production') {
        await prismaService.updateUser(user.id, { emailVerified: true });
        user.emailVerified = true;
        console.log('🔓 Development mode: Auto-verified email for', email);
      }

      // Update last login
      await prismaService.updateUser(user.id, { lastLoginAt: new Date() });

      // Create session
      const session = this.createSession(user);

      // Log successful login
      await prismaService.logSecurityEvent({
        userId: user.id,
        action: 'login_success',
        success: true,
        details: { email, provider: 'email' },
        ipAddress: ip,
        userAgent: userAgent
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          provider: user.provider,
          twoFactorEnabled: user.twoFactorEnabled,
          createdAt: user.createdAt
        },
        session
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(email) {
    try {
      const user = this.users.get(email);
      if (!user) {
        // Don't reveal if user exists for security
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent'
        };
      }

      // Generate reset token
      const resetToken = securityService.generatePasswordResetToken();
      
      this.passwordResetTokens.set(resetToken.token, {
        email,
        expiresAt: resetToken.expiresAt
      });

      // Send reset email
      await emailService.sendPasswordResetEmail(email, resetToken.token, user.name);

      securityService.logSecurityEvent('PASSWORD_RESET_REQUESTED', email, {
        resetToken: resetToken.token
      });

      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: 'Failed to process password reset request'
      };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    try {
      const resetData = this.passwordResetTokens.get(token);
      if (!resetData || Date.now() > resetData.expiresAt) {
        return {
          success: false,
          error: 'Invalid or expired reset token'
        };
      }

      const user = this.users.get(resetData.email);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Validate new password
      const passwordValidation = securityService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: passwordValidation.errors.join(', ')
        };
      }

      // Hash new password
      const hashedPassword = await securityService.hashPassword(newPassword);
      
      // Update user
      user.password = hashedPassword;
      user.updatedAt = new Date().toISOString();
      this.users.set(resetData.email, user);

      // Remove reset token
      this.passwordResetTokens.delete(token);

      securityService.logSecurityEvent('PASSWORD_RESET', resetData.email, {
        resetToken: token
      });

      return {
        success: true,
        message: 'Password has been reset successfully'
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: 'Failed to reset password'
      };
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token) {
    try {
      const verificationData = this.emailVerificationTokens.get(token);
      if (!verificationData || Date.now() > verificationData.expiresAt) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        };
      }

      const user = this.users.get(verificationData.email);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Update user
      user.emailVerified = true;
      user.updatedAt = new Date().toISOString();
      this.users.set(verificationData.email, user);

      // Remove verification token
      this.emailVerificationTokens.delete(token);

      securityService.logSecurityEvent('EMAIL_VERIFIED', verificationData.email, {
        verificationToken: token
      });

      return {
        success: true,
        message: 'Email has been verified successfully'
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        error: 'Failed to verify email'
      };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email) {
    try {
      const user = this.users.get(email);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      if (user.emailVerified) {
        return {
          success: false,
          error: 'Email is already verified'
        };
      }

      // Generate new verification token
      const verificationToken = securityService.generateEmailVerificationToken();
      
      this.emailVerificationTokens.set(verificationToken.token, {
        email,
        expiresAt: verificationToken.expiresAt
      });

      // Send verification email
      await emailService.sendVerificationEmail(email, verificationToken.token, user.name);

      securityService.logSecurityEvent('VERIFICATION_EMAIL_RESENT', email, {
        verificationToken: verificationToken.token
      });

      return {
        success: true,
        message: 'Verification email has been sent'
      };
    } catch (error) {
      console.error('Resend verification error:', error);
      return {
        success: false,
        error: 'Failed to resend verification email'
      };
    }
  }

  /**
   * Get user by email
   */
  getUserByEmail(email) {
    return this.users.get(email);
  }

  /**
   * Get security audit log
   */
  getSecurityAuditLog(email = null) {
    return securityService.getAuditLog(email);
  }
}

module.exports = new AuthService();
