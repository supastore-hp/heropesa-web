/**
 * ============================================================
 * requireAuth.js — Heropesa SSO Auth Guard
 * ============================================================
 *
 * Drop this script at the very top of <body> in any protected
 * app (pos_web, erp_web, crm_web, etc.).
 *
 * It will:
 *   1. Check localStorage for `supastore_sso_token`
 *   2. If missing  → instantly redirect to /sso_web/sso.html
 *   3. If present  → do nothing (let the protected app load)
 *   4. Expose window.SSOGuard for runtime use (logout, getUser)
 *
 * ZERO dependency on any business-app logic.
 * ============================================================
 */

(function () {
  'use strict';

  var TOKEN_KEY = 'supastore_sso_token';
  var USER_KEY  = 'supastore_sso_user';

  // ─── Determine the SSO login URL ─────────────────────────────
  // Works in both file:// (dev) and http:// (served) contexts.
  function _getSSOUrl() {
    var base = window.location.origin;
    // If opened as file, use relative path
    if (base === 'null' || base === 'file://') {
      return '../sso_web/sso.html';
    }
    return '/sso_web/sso.html';
  }

  // ─── Core Guard ──────────────────────────────────────────────
  var token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    // Block render immediately — set body invisible before redirect
    document.documentElement.style.visibility = 'hidden';
    window.location.replace(_getSSOUrl() + '?redirect=' + encodeURIComponent(window.location.href));
    // Hard-stop execution for this script; app scripts below will not run
    throw new Error('[SSOGuard] No valid session. Redirecting to SSO login.');
  }

  // ─── Session Utilities ───────────────────────────────────────
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = _getSSOUrl();
  }

  /**
   * Checks if the user has a given permission/role.
   * @param {string} permission — e.g. 'pos', 'erp', 'admin'
   * @returns {boolean}
   */
  function hasPermission(permission) {
    var user = getUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  }

  /**
   * Renders a small SSO session badge in the top-right corner.
   * Useful for showing who is logged in across apps.
   * Call this after DOMContentLoaded.
   */
  function injectSessionBadge() {
    var user = getUser();
    if (!user) return;

    var badge = document.createElement('div');
    badge.id = 'sso-session-badge';
    badge.setAttribute('aria-label', 'Signed in as ' + user.firstName + ' ' + user.lastName);
    badge.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;cursor:pointer;" id="sso-badge-trigger">' +
        '<div style="width:28px;height:28px;border-radius:50%;background:#1a73e8;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          (user.avatar || (user.firstName[0] + user.lastName[0]).toUpperCase()) +
        '</div>' +
        '<div style="line-height:1.2;">' +
          '<div style="font-size:12px;font-weight:600;color:#202124;">' + user.firstName + ' ' + user.lastName + '</div>' +
          '<div style="font-size:10px;color:#5f6368;text-transform:capitalize;">' + user.role + ' · SSO</div>' +
        '</div>' +
      '</div>' +
      '<div id="sso-badge-menu" style="display:none;position:absolute;right:0;top:44px;background:#fff;border:1px solid #dadce0;border-radius:8px;min-width:200px;padding:6px 0;box-shadow:0 4px 16px rgba(60,64,67,0.2);z-index:9999;">' +
        '<div style="padding:12px 16px;border-bottom:1px solid #f1f3f4;">' +
          '<div style="font-size:13px;font-weight:600;color:#202124;">' + user.firstName + ' ' + user.lastName + '</div>' +
          '<div style="font-size:11px;color:#5f6368;">' + user.email + '</div>' +
        '</div>' +
        '<a href="/sso_web/sso.html" style="display:block;padding:8px 16px;font-size:13px;color:#5f6368;text-decoration:none;transition:background 0.2s;" onmouseover="this.style.background=\'#f8f9fa\'" onmouseout="this.style.background=\'\'">🔐 SSO Account</a>' +
        '<div id="sso-signout-btn" style="padding:8px 16px;font-size:13px;color:#ea4335;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background=\'#fce8e6\'" onmouseout="this.style.background=\'\'">↩ Sign Out</div>' +
      '</div>';

    badge.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:16px',
      'z-index:99999',
      'background:#fff',
      'border:1px solid #dadce0',
      'border-radius:24px',
      'padding:5px 12px 5px 5px',
      'box-shadow:0 1px 4px rgba(60,64,67,0.2)',
      'font-family:Inter,system-ui,sans-serif',
      'transition:box-shadow 0.2s',
    ].join(';');

    badge.addEventListener('mouseenter', function () {
      badge.style.boxShadow = '0 4px 12px rgba(60,64,67,0.25)';
    });
    badge.addEventListener('mouseleave', function () {
      badge.style.boxShadow = '0 1px 4px rgba(60,64,67,0.2)';
    });

    // Toggle menu
    badge.querySelector('#sso-badge-trigger').addEventListener('click', function (e) {
      e.stopPropagation();
      var menu = badge.querySelector('#sso-badge-menu');
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    // Close on outside click
    document.addEventListener('click', function () {
      var menu = badge.querySelector('#sso-badge-menu');
      if (menu) menu.style.display = 'none';
    });

    // Sign-out button
    badge.querySelector('#sso-signout-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      logout();
    });

    document.body.appendChild(badge);
  }

  // ─── Export Public API ───────────────────────────────────────
  window.SSOGuard = {
    getUser:            getUser,
    logout:             logout,
    hasPermission:      hasPermission,
    injectSessionBadge: injectSessionBadge,
  };

  // Auto-inject badge after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSessionBadge);
  } else {
    injectSessionBadge();
  }

})();
