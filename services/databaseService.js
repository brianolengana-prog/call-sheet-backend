const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY, // Use service role key for backend operations
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user by provider and provider ID
   */
  async getUserByProvider(provider, providerId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('provider', provider)
        .eq('provider_id', providerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting user by provider:', error);
      throw error;
    }
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id) {
    try {
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Create password reset token
   */
  async createPasswordResetToken(userId, token, expiresAt) {
    try {
      const { data, error } = await this.supabase
        .from('password_reset_tokens')
        .insert([{
          user_id: userId,
          token: token,
          expires_at: expiresAt
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating password reset token:', error);
      throw error;
    }
  }

  /**
   * Get password reset token
   */
  async getPasswordResetToken(token) {
    try {
      const { data, error } = await this.supabase
        .from('password_reset_tokens')
        .select('*, users(*)')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting password reset token:', error);
      throw error;
    }
  }

  /**
   * Mark password reset token as used
   */
  async markPasswordResetTokenAsUsed(token) {
    try {
      const { error } = await this.supabase
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('token', token);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error marking password reset token as used:', error);
      throw error;
    }
  }

  /**
   * Create email verification token
   */
  async createEmailVerificationToken(userId, token, expiresAt) {
    try {
      const { data, error } = await this.supabase
        .from('email_verification_tokens')
        .insert([{
          user_id: userId,
          token: token,
          expires_at: expiresAt
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating email verification token:', error);
      throw error;
    }
  }

  /**
   * Get email verification token
   */
  async getEmailVerificationToken(token) {
    try {
      const { data, error } = await this.supabase
        .from('email_verification_tokens')
        .select('*, users(*)')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting email verification token:', error);
      throw error;
    }
  }

  /**
   * Mark email verification token as used
   */
  async markEmailVerificationTokenAsUsed(token) {
    try {
      const { error } = await this.supabase
        .from('email_verification_tokens')
        .update({ used: true })
        .eq('token', token);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error marking email verification token as used:', error);
      throw error;
    }
  }

  /**
   * Create two-factor code
   */
  async createTwoFactorCode(userId, code, expiresAt) {
    try {
      const { data, error } = await this.supabase
        .from('two_factor_codes')
        .insert([{
          user_id: userId,
          code: code,
          expires_at: expiresAt
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating two-factor code:', error);
      throw error;
    }
  }

  /**
   * Get two-factor code
   */
  async getTwoFactorCode(userId, code) {
    try {
      const { data, error } = await this.supabase
        .from('two_factor_codes')
        .select('*')
        .eq('user_id', userId)
        .eq('code', code)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting two-factor code:', error);
      throw error;
    }
  }

  /**
   * Mark two-factor code as used
   */
  async markTwoFactorCodeAsUsed(userId, code) {
    try {
      const { error } = await this.supabase
        .from('two_factor_codes')
        .update({ used: true })
        .eq('user_id', userId)
        .eq('code', code);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error marking two-factor code as used:', error);
      throw error;
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventData) {
    try {
      const { data, error } = await this.supabase
        .from('security_audit_log')
        .insert([eventData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error logging security event:', error);
      throw error;
    }
  }

  /**
   * Get security audit log for user
   */
  async getSecurityAuditLog(userId, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('security_audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting security audit log:', error);
      throw error;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens() {
    try {
      const { error } = await this.supabase
        .rpc('cleanup_expired_tokens');

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }

  /**
   * Update user's last login
   */
  async updateLastLogin(email) {
    try {
      const { error } = await this.supabase
        .rpc('update_last_login', { user_email: email });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  /**
   * Increment login attempts
   */
  async incrementLoginAttempts(email) {
    try {
      const { error } = await this.supabase
        .rpc('increment_login_attempts', { user_email: email });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error incrementing login attempts:', error);
      throw error;
    }
  }

  /**
   * Reset login attempts
   */
  async resetLoginAttempts(email) {
    try {
      const { error } = await this.supabase
        .rpc('reset_login_attempts', { user_email: email });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error resetting login attempts:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
