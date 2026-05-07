/* ============================================================
   AUTH.JS — Login modal (existing users) · Help modal · Auth state · Protected links
   ============================================================ */
(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────
  var intendedHref  = null;
  var resendInterval = null;
  var pendingUid    = null;   // set after registration check passes, used to complete login

  // Demo accounts: phone (10 digits) → email created by seed.py
  var DEMO_PHONES = {
    '9863010001': 'demo+919863010001@foscos.local',
    '9863010002': 'demo+919863010002@foscos.local',
    '9863010003': 'demo+919863010003@foscos.local',
    '9863010004': 'demo+919863010004@foscos.local',
    '9863010005': 'demo+919863010005@foscos.local',
    '9863010006': 'demo+919863010006@foscos.local',
    '9863010007': 'demo+919863010007@foscos.local',
    '9863010008': 'demo+919863010008@foscos.local',
    '9863010009': 'demo+919863010009@foscos.local',
    '9863010010': 'demo+919863010010@foscos.local',
  };

  function $$(id) { return document.getElementById(id); }

  // ════════════════════════════════════════════════════════════
  // LOGIN MODAL
  // ════════════════════════════════════════════════════════════

  function openLoginModal(href) {
    if (href) intendedHref = href;
    showPhoneStep();
    $$('loginModalOverlay').classList.add('open');
    setTimeout(function () {
      var pi = $$('loginPhoneInput'); if (pi) pi.focus();
    }, 80);
  }
  window.openLoginModal = openLoginModal;

  function closeLoginModal() {
    $$('loginModalOverlay').classList.remove('open');
    resetLoginModal();
  }

  function resetLoginModal() {
    var pi = $$('loginPhoneInput'); if (pi) pi.value = '';
    document.querySelectorAll('.otp-digit').forEach(function (d) { d.value = ''; });
    clearError('loginPhoneStep');
    clearError('loginOtpStep');
    showPhoneStep();
    clearInterval(resendInterval);
    pendingUid = null;
    var rb = $$('loginRegisterBtn'); if (rb) rb.style.display = 'none';
  }

  function showPhoneStep() {
    setVisible('loginPhoneStep', true);
    setVisible('loginOtpStep',   false);
  }

  function showOtpStep(phone) {
    setVisible('loginPhoneStep', false);
    setVisible('loginOtpStep',   true);
    var disp = $$('loginOtpPhone');
    if (disp) disp.textContent = '+91 XXXXX' + phone.slice(5);
    var digits = document.querySelectorAll('.otp-digit');
    if (digits[0]) digits[0].focus();
    startResendTimer();
  }

  function handleSendOtp() {
    var pi = $$('loginPhoneInput');
    var phone = pi ? pi.value.trim().replace(/\D/g, '') : '';
    if (phone.length !== 10) {
      showError('loginPhoneStep', 'Enter a valid 10-digit mobile number.');
      return;
    }
    clearError('loginPhoneStep');
    var rb = $$('loginRegisterBtn'); if (rb) rb.style.display = 'none';

    var isDemo = !!DEMO_PHONES[phone];
    var email  = DEMO_PHONES[phone] || 'mock+91' + phone + '@foscos.local';

    setLoading($$('loginSendOtpBtn'), true, 'Checking…');

    firebase.auth().signInWithEmailAndPassword(email, '123456')
      .then(function (cred) {
        if (isDemo) {
          pendingUid = cred.user.uid;
          setLoading($$('loginSendOtpBtn'), false, 'Send OTP →');
          showOtpStep(phone);
          return;
        }
        return firebase.firestore().collection('users').doc(cred.user.uid).get()
          .then(function (doc) {
            var d = doc.exists ? doc.data() : {};
            var valid = LOGIN_PORTAL_STATUSES.indexOf(d.applicationStatus || '') !== -1
              || !!d.applicationId
              || !!(d.tempLicense && d.tempLicense.licenseNo);
            setLoading($$('loginSendOtpBtn'), false, 'Send OTP →');
            if (!valid) {
              return firebase.auth().signOut().then(showNotRegistered);
            }
            pendingUid = cred.user.uid;
            showOtpStep(phone);
          });
      })
      .catch(function (err) {
        console.error('[FOSCOS] login check:', err);
        setLoading($$('loginSendOtpBtn'), false, 'Send OTP →');
        if (isDemo) {
          showError('loginPhoneStep', 'Demo login failed — run seed.py first.');
        } else {
          showNotRegistered();
        }
      });
  }

  function afterLogin(uid) {
    var currentUser = firebase.auth().currentUser;
    if (currentUser && currentUser.email) {
      var emailMatch = currentUser.email.match(/^(?:mock|demo)\+91(\d+)@foscos\.local$/);
      if (emailMatch) {
        firebase.firestore().collection('users').doc(uid).set({
          phone: '+91' + emailMatch[1]
        }, { merge: true }).catch(function () {});
      }
    }
    closeLoginModal();
    if (intendedHref === 'fbo-select') {
      intendedHref = null;
      showFboTypeSelection();
      return;
    }
    if (intendedHref === 'track-smart') {
      intendedHref = null;
      doSmartTrackRoute(uid);
      return;
    }
    if (intendedHref && intendedHref !== '#') {
      window.location.href = intendedHref;
      intendedHref = null;
      return;
    }
    window.location.href = '/fbo-portal';
  }

  function showFboTypeSelection() {
    showFboSubMenu();
    openHelpModal();
  }

  var LOGIN_PORTAL_STATUSES = ['submitted','pending','approved','documents_requested',
    'inspection_scheduled','inspection_complete','final_review'];

  function showNotRegistered() {
    showError('loginPhoneStep', 'This number is not registered. Please register first.');
    var rb = $$('loginRegisterBtn'); if (rb) rb.style.display = '';
  }

  function handleVerifyOtp() {
    var digits = document.querySelectorAll('.otp-digit');
    var otp = Array.from(digits).map(function (d) { return d.value; }).join('');
    if (otp.length !== 6) return;
    if (!pendingUid) return;

    clearError('loginOtpStep');

    if (otp !== '123456') {
      showError('loginOtpStep', 'Incorrect OTP. Enter 123456 to continue.');
      digits.forEach(function (d) { d.value = ''; });
      if (digits[0]) digits[0].focus();
      return;
    }

    afterLogin(pendingUid);
  }

  function handleResendOtp() {
    clearError('loginOtpStep');
    startResendTimer();
  }

  function startResendTimer() {
    var secs = 30;
    var rb = $$('loginResendBtn'), rt = $$('loginResendTimer');
    if (rb) rb.style.display = 'none';
    if (rt) { rt.textContent = 'Resend in ' + secs + 's'; rt.style.display = 'inline'; }
    clearInterval(resendInterval);
    resendInterval = setInterval(function () {
      secs--;
      if (secs <= 0) {
        clearInterval(resendInterval);
        if (rt) rt.style.display = 'none';
        if (rb) rb.style.display = 'inline';
      } else {
        if (rt) rt.textContent = 'Resend in ' + secs + 's';
      }
    }, 1000);
  }

  function setupLoginOtpInputs() {
    var digits = document.querySelectorAll('#loginOtpStep .otp-digit');
    digits.forEach(function (input, i) {
      input.addEventListener('input', function (e) {
        var val = e.target.value.replace(/\D/g, '');
        if (val.length > 1) {
          var code = val.slice(0, 6);
          digits.forEach(function (d, j) { d.value = code[j] || ''; });
          var focus = digits[Math.min(code.length, digits.length - 1)];
          if (focus) focus.focus();
        } else {
          e.target.value = val;
          if (val && i < digits.length - 1) digits[i + 1].focus();
        }
        var otp = Array.from(digits).map(function (d) { return d.value; }).join('');
        if (otp.length === 6) handleVerifyOtp();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !e.target.value && i > 0) digits[i - 1].focus();
      });
      input.addEventListener('paste', function (e) {
        e.preventDefault();
        var pasted = (e.clipboardData || window.clipboardData)
          .getData('text').replace(/\D/g, '').slice(0, 6);
        digits.forEach(function (d, j) { d.value = pasted[j] || ''; });
        var focus = digits[Math.min(pasted.length, digits.length - 1)];
        if (focus) focus.focus();
        if (pasted.length === 6) setTimeout(handleVerifyOtp, 80);
      });
    });
  }

  // ════════════════════════════════════════════════════════════
  // HELP MODAL (P02 — "Namaste! How can we help?")
  // ════════════════════════════════════════════════════════════

  function openHelpModal() {
    var ov = $$('helpModalOverlay'); if (ov) ov.classList.add('open');
  }

  function closeHelpModal() {
    var ov = $$('helpModalOverlay'); if (ov) ov.classList.remove('open');
    showHelpMainMenu();
  }

  function showFboSubMenu() {
    var main = $$('helpMainOptions'); if (main) main.style.display = 'none';
    var sub  = $$('helpFboSubMenu');  if (sub)  sub.style.display  = '';
  }

  function showHelpMainMenu() {
    var main = $$('helpMainOptions'); if (main) main.style.display = '';
    var sub  = $$('helpFboSubMenu');  if (sub)  sub.style.display  = 'none';
  }

  // ════════════════════════════════════════════════════════════
  // AUTH STATE OBSERVER
  // ════════════════════════════════════════════════════════════

  function handleAuthStateChange(user) {
    var lb = $$('btnLogin');
    var ns = $$('navUserSection');

    if (user) {
      if (lb) lb.style.display = 'none';
      if (ns) {
        var displayName = (user.displayName || '').trim();
        var phone       = user.phoneNumber || '';
        var last4       = phone.slice(-4);
        var initials    = displayName
          ? displayName.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()
          : last4.slice(0, 2);
        var label = displayName || ('+91 ••••• ' + last4);

        ns.innerHTML =
          '<div class="nav-user" id="navUserTrigger">' +
            '<div class="nav-user__avatar">' + initials + '</div>' +
            '<span class="nav-user__phone">' + label + '</span>' +
            '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">' +
              '<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>' +
            '<div class="nav-user__dropdown" id="navUserDropdown">' +
              '<button id="btnDashboard">Go to Dashboard</button>' +
              '<button id="btnLogout">Sign out</button>' +
            '</div>' +
          '</div>';
        ns.style.display = 'flex';

        $$('navUserTrigger').addEventListener('click', function (e) {
          e.stopPropagation();
          $$('navUserDropdown').classList.toggle('open');
        });
        document.addEventListener('click', function () {
          var dd = $$('navUserDropdown'); if (dd) dd.classList.remove('open');
        });
        $$('btnDashboard').addEventListener('click', function () {
          window.location.href = '/fbo-portal';
        });
        $$('btnLogout').addEventListener('click', function () {
          firebase.auth().signOut().then(function () {
            window.location.href = '/';
          });
        });
      }
    } else {
      if (lb) lb.style.display = '';
      if (ns) { ns.innerHTML = ''; ns.style.display = 'none'; }
    }
  }

  // ════════════════════════════════════════════════════════════
  // PROTECTED LINKS
  // ════════════════════════════════════════════════════════════

  function setupProtectedLinks() {
    document.querySelectorAll('[data-requires-auth]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (!firebase.auth().currentUser) {
          e.preventDefault();
          e.stopPropagation();
          intendedHref = el.getAttribute('href') || null;
          openLoginModal();
        }
      });
    });
  }

  function doSmartTrackRoute(uid) {
    var PORTAL_STATUSES = ['submitted','pending','approved','documents_requested',
      'inspection_scheduled','inspection_complete','final_review'];
    firebase.firestore().collection('users').doc(uid).get()
      .then(function (doc) {
        var d = doc.exists ? doc.data() : {};
        if (PORTAL_STATUSES.indexOf(d.applicationStatus || '') !== -1 || d.tempLicense) {
          window.location.href = '/track-application';
        } else {
          window.location.href = '/fbo-portal';
        }
      })
      .catch(function () { window.location.href = '/fbo-portal'; });
  }

  function doTempLicenseRoute(uid) {
    firebase.firestore().collection('users').doc(uid).get()
      .then(function (doc) {
        var tl = doc.exists ? (doc.data().tempLicense || {}) : {};
        if (tl.licenseNo) {
          window.location.href = '/temp-license/issued';
        } else if (tl.purpose) {
          window.location.href = '/temp-license/details';
        } else {
          window.location.href = '/temp-license';
        }
      })
      .catch(function () { window.location.href = '/temp-license'; });
  }

  function doPermLicenseRoute(uid) {
    var PORTAL_STATUSES = ['submitted','pending','approved','documents_requested',
      'inspection_scheduled','inspection_complete','final_review'];
    firebase.firestore().collection('users').doc(uid).get()
      .then(function (doc) {
        var d = doc.exists ? doc.data() : {};
        if (PORTAL_STATUSES.indexOf(d.applicationStatus || '') !== -1) {
          window.location.href = '/fbo-portal'; return;
        }
        if (!d.businessTypes || !d.businessTypes.length) { window.location.href = '/about-business'; return; }
        if (!d.foodTypes || !d.foodTypes.length) { window.location.href = '/food-type'; return; }
        if (!d.scale || !d.scale.tier) { window.location.href = '/scale'; return; }
        if (!d.details || !d.details.bizName) { window.location.href = '/business-details'; return; }
        if (!isDocumentsComplete(d)) { window.location.href = '/documents'; return; }
        if (!d.review) { window.location.href = '/one-stop-shop?from=documents'; return; }
        window.location.href = '/review';
      })
      .catch(function () { window.location.href = '/about-business'; });
  }

  function isDocumentsComplete(d) {
    if (!d.documents) return false;
    var tier = d.scale && d.scale.tier;
    var required = ['selfie'];
    if (tier === 'basic' || tier === 'state' || tier === 'central') {
      required.push('idProof', 'addressProof');
    }
    if (tier === 'state' || tier === 'central') {
      required.push('form9', 'blueprint');
    }
    return required.every(function (k) { return d.documents[k]; });
  }

  // ════════════════════════════════════════════════════════════
  // UTILITIES
  // ════════════════════════════════════════════════════════════

  function setVisible(id, show) {
    var el = $$(id); if (el) el.style.display = show ? '' : 'none';
  }

  function setLoading(btn, loading, label) {
    if (!btn) return; btn.disabled = loading; btn.textContent = label;
  }

  function showError(stepId, msg) {
    var container = $$(stepId); if (!container) return;
    var el = container.querySelector('.login-error');
    if (!el) { el = document.createElement('p'); el.className = 'login-error'; container.appendChild(el); }
    el.textContent = msg;
  }

  function clearError(stepId) {
    var container = $$(stepId); if (!container) return;
    var el = container.querySelector('.login-error'); if (el) el.textContent = '';
  }

  // ════════════════════════════════════════════════════════════
  // INIT — wire up all event listeners
  // ════════════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', function () {

    // ── Login modal ──────────────────────────────────────────
    var loginOverlay = $$('loginModalOverlay');
    if (loginOverlay) {
      loginOverlay.addEventListener('click', function (e) {
        if (e.target === loginOverlay) closeLoginModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (loginOverlay && loginOverlay.classList.contains('open')) closeLoginModal();
        closeHelpModal();
      }
    });

    var cb = $$('btnModalClose'); if (cb) cb.addEventListener('click', closeLoginModal);
    var lb = $$('btnLogin');     if (lb) lb.addEventListener('click', function () { openLoginModal(); });

    var sob = $$('loginSendOtpBtn');
    if (sob) sob.addEventListener('click', handleSendOtp);
    var pi = $$('loginPhoneInput');
    if (pi) pi.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSendOtp(); });

    var vob = $$('loginVerifyOtpBtn');
    if (vob) vob.addEventListener('click', handleVerifyOtp);

    var rb = $$('loginResendBtn');
    if (rb) rb.addEventListener('click', function (e) { e.preventDefault(); handleResendOtp(); });

    var regBtn = $$('loginRegisterBtn');
    if (regBtn) regBtn.addEventListener('click', function () {
      closeLoginModal();
      window.location.href = '/signup';
    });

    setupLoginOtpInputs();

    // ── Help modal ───────────────────────────────────────────
    var helpOverlay = $$('helpModalOverlay');
    if (helpOverlay) {
      helpOverlay.addEventListener('click', function (e) {
        if (e.target === helpOverlay) closeHelpModal();
      });
    }

    var hc = $$('btnHelpClose');
    if (hc) hc.addEventListener('click', closeHelpModal);

    // Hero "Hello — How can we help?" button (home page only)
    var oh = $$('btnOpenHelp');
    if (oh) oh.addEventListener('click', openHelpModal);

    // FBO button — unauthenticated users go to signup; logged-in users see license selection
    var fbo = $$('btnHelpFbo');
    if (fbo) {
      fbo.addEventListener('click', function () {
        closeHelpModal();
        var user = (firebase.apps && firebase.apps.length) ? firebase.auth().currentUser : null;
        if (!user) {
          window.location.href = '/signup';
        } else {
          showFboTypeSelection();
        }
      });
    }

    var fboBack = $$('btnHelpFboBack');
    if (fboBack) fboBack.addEventListener('click', showHelpMainMenu);

    var tlHelpBtn = $$('btnHelpTempLicense');
    if (tlHelpBtn) {
      tlHelpBtn.addEventListener('click', function () {
        closeHelpModal();
        var user = (firebase.apps && firebase.apps.length) ? firebase.auth().currentUser : null;
        if (user) {
          doTempLicenseRoute(user.uid);
        } else {
          sessionStorage.removeItem('tlLastPage');
          sessionStorage.setItem('tlFlow', '1');
          window.location.href = '/signup';
        }
      });
    }

    var plHelpBtn = $$('btnHelpPermLicense');
    if (plHelpBtn) {
      plHelpBtn.addEventListener('click', function () {
        closeHelpModal();
        var user = (firebase.apps && firebase.apps.length) ? firebase.auth().currentUser : null;
        if (user) {
          doPermLicenseRoute(user.uid);
        } else {
          window.location.href = '/signup';
        }
      });
    }

    // ── Permanent License card (home page) ───────────────────
    var plCard = $$('cardPermanentLicense');
    if (plCard) {
      plCard.addEventListener('click', function (e) {
        e.preventDefault();
        var user = (firebase.apps && firebase.apps.length) ? firebase.auth().currentUser : null;
        if (user) {
          doPermLicenseRoute(user.uid);
        } else {
          window.location.href = '/signup';
        }
      });
    }

    // ── Instant License card (home page) ─────────────────────
    var tlCard = $$('cardInstantLicense');
    if (tlCard) {
      tlCard.addEventListener('click', function (e) {
        e.preventDefault();
        var user = (firebase.apps && firebase.apps.length) ? firebase.auth().currentUser : null;
        if (user) {
          doTempLicenseRoute(user.uid);
        } else {
          sessionStorage.removeItem('tlLastPage');
          sessionStorage.setItem('tlFlow', '1');
          window.location.href = '/signup';
        }
      });
    }

    // ── Track Application card (home page) ────────────────────
    var trackCard = $$('cardTrackStatus');
    if (trackCard) {
      trackCard.addEventListener('click', function (e) {
        e.preventDefault();
        var user = (firebase.apps && firebase.apps.length) ? firebase.auth().currentUser : null;
        if (!user) {
          intendedHref = 'track-smart';
          openLoginModal();
          return;
        }
        doSmartTrackRoute(user.uid);
      });
    }

    // ── Protected links ──────────────────────────────────────
    setupProtectedLinks();
  });

  // Start auth state observer once Firebase is initialised
  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(handleAuthStateChange);
  });

})();
