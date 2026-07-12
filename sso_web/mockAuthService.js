/**
 * ============================================================
 * mockAuthService.js — Heropesa SSO Identity Provider (Mock)
 * ============================================================
 *
 * ARCHITECTURE NOTE:
 * This file is the ONLY file that needs to be swapped out when
 * the real Node.js/PostgreSQL backend is ready.
 * All other files (sso.html, requireAuth.js) depend on the
 * public API surface defined here:
 *   - AuthService.login(email, password)   → Promise<{ token, user } | Error>
 *   - AuthService.signup(data)             → Promise<{ token, user } | Error>
 *   - AuthService.logout()                 → void
 *   - AuthService.getSession()             → { token, user } | null
 *   - AuthService.isAuthenticated()        → boolean
 *
 * Replace this file with a real HTTP-based implementation and
 * the entire auth flow continues to work seamlessly.
 * ============================================================
 */

(function (global) {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────
  const TOKEN_KEY = 'supastore_sso_token';
  const USER_KEY  = 'supastore_sso_user';
  const NETWORK_DELAY_MS = 1200; // Simulated network latency

  // ─── Mock User Database ──────────────────────────────────────
  // In production: replace with POST /api/auth/login
  const MOCK_USERS = [
    {
      id: 'usr_001',
      email: 'admin@supastore.co.tz',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'Heropesa',
      role: 'admin',
      company: 'Heropesa Global Inc.',
      avatar: 'AH',
      permissions: ['pos', 'erp', 'crm', 'hr', 'reports', 'settings'],
    },
    {
      id: 'usr_002',
      email: 'cashier@supastore.co.tz',
      password: 'cashier123',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'cashier',
      company: 'Heropesa Global Inc.',
      avatar: 'JD',
      permissions: ['pos'],
    },
    {
      id: 'usr_003',
      email: 'manager@supastore.co.tz',
      password: 'manager123',
      firstName: 'Mark',
      lastName: 'Chen',
      role: 'manager',
      company: 'Heropesa Global Inc.',
      avatar: 'MC',
      permissions: ['pos', 'erp', 'reports'],
    },
    {
      id: 'usr_004',
      email: 'demo@heropesa.com',
      password: 'demo1234',
      firstName: 'Demo',
      lastName: 'User',
      role: 'viewer',
      company: 'Demo Corp',
      avatar: 'DU',
      permissions: ['pos', 'erp', 'crm'],
    },
  ];

  // In-memory sign-up store (persisted to sessionStorage for demo)
  function _getSignupStore() {
    try {
      return JSON.parse(sessionStorage.getItem('supastore_sso_signups') || '[]');
    } catch (_) {
      return [];
    }
  }

  function _saveSignupStore(users) {
    sessionStorage.setItem('supastore_sso_signups', JSON.stringify(users));
  }

  // ─── Fake JWT Generator ──────────────────────────────────────
  // Produces a realistic-looking but non-verifiable JWT string.
  // In production: the real backend issues a signed RS256/HS256 token.
  function _generateFakeJWT(user) {
    const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60), // 8 hours
      iss: 'heropesa-sso',
    }));
    // Mock signature (not cryptographically valid)
    const signature = btoa(`mock.sig.${user.id}.${Date.now()}`);
    return `${header}.${payload}.${signature}`;
  }

  // ─── Validation Helpers ──────────────────────────────────────
  function _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function _isValidPassword(password) {
    return typeof password === 'string' && password.length >= 8;
  }

  // ─── Session Management ──────────────────────────────────────
  function _persistSession(token, user) {
    // Strip the password before persisting
    const safeUser = { ...user };
    delete safeUser.password;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
  }

  function _clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * login(email, password)
   * Simulates an async POST /api/auth/login call.
   * @returns Promise<{ token: string, user: object }>
   */
  function login(email, password) {
    return new Promise(function (resolve, reject) {
      // Basic client-side validation (mirrors server-side)
      if (!email || !_isValidEmail(email)) {
        return setTimeout(function () {
          reject(new Error('Please enter a valid email address.'));
        }, 300);
      }
      if (!password) {
        return setTimeout(function () {
          reject(new Error('Password is required.'));
        }, 300);
      }

      setTimeout(function () {
        // Search mock DB + in-session signups
        const allUsers = MOCK_USERS.concat(_getSignupStore());
        const user = allUsers.find(function (u) {
          return u.email.toLowerCase() === email.toLowerCase() &&
                 u.password === password;
        });

        if (!user) {
          return reject(new Error('Invalid email or password. Please check your credentials and try again.'));
        }

        const token = _generateFakeJWT(user);
        _persistSession(token, user);

        const safeUser = { ...user };
        delete safeUser.password;
        resolve({ token: token, user: safeUser });
      }, NETWORK_DELAY_MS);
    });
  }

  /**
   * signup(data)
   * Simulates an async POST /api/auth/signup call.
   * @param {object} data - { firstName, lastName, email, password, company }
   * @returns Promise<{ token: string, user: object }>
   */
  function signup(data) {
    return new Promise(function (resolve, reject) {
      var firstName = (data.firstName || '').trim();
      var lastName  = (data.lastName  || '').trim();
      var email     = (data.email     || '').trim();
      var password  = data.password   || '';
      var company   = (data.company   || '').trim();

      // Validation
      if (!firstName || !lastName) {
        return setTimeout(function () {
          reject(new Error('First name and last name are required.'));
        }, 300);
      }
      if (!_isValidEmail(email)) {
        return setTimeout(function () {
          reject(new Error('Please enter a valid email address.'));
        }, 300);
      }
      if (!_isValidPassword(password)) {
        return setTimeout(function () {
          reject(new Error('Password must be at least 8 characters long.'));
        }, 300);
      }

      setTimeout(function () {
        // Check for duplicate email
        const allUsers = MOCK_USERS.concat(_getSignupStore());
        const existing = allUsers.find(function (u) {
          return u.email.toLowerCase() === email.toLowerCase();
        });
        if (existing) {
          return reject(new Error('An account with this email already exists. Please sign in instead.'));
        }

        // Create the new user
        const newUser = {
          id:          'usr_' + Date.now(),
          email:       email,
          password:    password, // In production: hashed server-side
          firstName:   firstName,
          lastName:    lastName,
          role:        'member',
          company:     company || 'N/A',
          avatar:      (firstName[0] + lastName[0]).toUpperCase(),
          permissions: ['pos', 'erp', 'crm'],
        };

        // Persist in session store
        const signups = _getSignupStore();
        signups.push(newUser);
        _saveSignupStore(signups);

        const token = _generateFakeJWT(newUser);
        _persistSession(token, newUser);

        const safeUser = { ...newUser };
        delete safeUser.password;
        resolve({ token: token, user: safeUser });
      }, NETWORK_DELAY_MS);
    });
  }

  /**
   * logout()
   * Clears the session and optionally redirects.
   */
  function logout(redirectUrl) {
    _clearSession();
    var target = redirectUrl || '/sso_web/sso.html';
    window.location.href = target;
  }

  /**
   * getSession()
   * Returns the current session from localStorage, or null.
   * @returns {{ token: string, user: object } | null}
   */
  function getSession() {
    var token = localStorage.getItem(TOKEN_KEY);
    var userStr = localStorage.getItem(USER_KEY);
    if (!token || !userStr) return null;
    try {
      var user = JSON.parse(userStr);
      return { token: token, user: user };
    } catch (_) {
      return null;
    }
  }

  /**
   * isAuthenticated()
   * Quick boolean check for token presence.
   * @returns {boolean}
   */
  function isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  // ─── Export ──────────────────────────────────────────────────
  global.AuthService = {
    login:           login,
    signup:          signup,
    logout:          logout,
    getSession:      getSession,
    isAuthenticated: isAuthenticated,
    TOKEN_KEY:       TOKEN_KEY,
  };

})(window);
