/* ============================================================
   SIGNUP_VERIFY.JS — /signup/verify page (P05):
   OTP verify → ✅ Verified → name step → /about-business
   ============================================================ */
(function () {
  'use strict';

  var resendInterval = null;

  function $$(id) { return document.getElementById(id); }

  function setError(id, msg) {
    var el = $$(id); if (el) el.textContent = msg;
  }

  function setLoading(id, loading, label) {
    var btn = $$(id); if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = loading ? label + '…' : label;
  }

  // ── OTP digit inputs ─────────────────────────────────────────
  function setupOtpInputs() {
    var digits = document.querySelectorAll('.signup-otp-digit');
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

  // ── Resume an existing registered user after OTP ─────────────
  function resumeExistingUser(uid) {
    var PORTAL_STATUSES = ['submitted','pending','approved','documents_requested',
      'inspection_scheduled','inspection_complete','final_review'];
    firebase.firestore().collection('users').doc(uid).get().then(function (doc) {
      var d = doc.exists ? doc.data() : {};
      if (PORTAL_STATUSES.indexOf(d.applicationStatus || '') !== -1
          || d.applicationId || (d.tempLicense && d.tempLicense.licenseNo)) {
        window.location.href = '/fbo-portal'; return;
      }
      if (sessionStorage.getItem('tlFlow') === '1') {
        sessionStorage.removeItem('tlFlow');
        var lastPage = sessionStorage.getItem('tlLastPage') || '/temp-license';
        sessionStorage.removeItem('tlLastPage');
        window.location.href = lastPage; return;
      }
      if (!d.businessTypes || !d.businessTypes.length) { window.location.href = '/about-business'; return; }
      if (!d.foodTypes     || !d.foodTypes.length)     { window.location.href = '/food-type'; return; }
      if (!d.scale         || !d.scale.tier)           { window.location.href = '/scale'; return; }
      if (!d.details       || !d.details.bizName)      { window.location.href = '/business-details'; return; }
      if (!d.documents)                                { window.location.href = '/documents'; return; }
      if (!d.review)                                   { window.location.href = '/one-stop-shop?from=documents'; return; }
      window.location.href = '/review';
    }).catch(function () { showVerifiedThenName(); });
  }

  // ── Verify OTP (mock — always 123456) ───────────────────────
  function handleVerifyOtp() {
    var digits = document.querySelectorAll('.signup-otp-digit');
    var otp    = Array.from(digits).map(function (d) { return d.value; }).join('');
    if (otp.length !== 6) return;

    var phone = sessionStorage.getItem('signup_phone');
    if (!phone) { window.location.href = '/signup'; return; }

    if (otp !== '123456') {
      setError('signupOtpError', 'Incorrect OTP. Enter 123456 to continue.');
      digits.forEach(function (d) { d.value = ''; });
      if (digits[0]) digits[0].focus();
      return;
    }

    setError('signupOtpError', '');
    setLoading('signupVerifyOtpBtn', true, 'Verifying');

    var email    = 'mock+91' + phone + '@foscos.local';
    var password = '123456';

    var isNewAccount = false;
    firebase.auth().signInWithEmailAndPassword(email, password)
      .catch(function (err) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' ||
            err.code === 'auth/invalid-email') {
          isNewAccount = true;
          return firebase.auth().createUserWithEmailAndPassword(email, password);
        }
        throw err;
      })
      .then(function () {
        if (isNewAccount) {
          showVerifiedThenName();
        } else {
          resumeExistingUser(firebase.auth().currentUser.uid);
        }
      })
      .catch(function (err) {
        console.error('[FOSCOS] mock signup verify:', err);
        setError('signupOtpError', 'Could not verify. Please try again.');
        digits.forEach(function (d) { d.value = ''; });
        if (digits[0]) digits[0].focus();
        setLoading('signupVerifyOtpBtn', false, 'Verify & Continue →');
      });
  }

  function showVerifiedThenName() {
    // Hide OTP header and form; show ✅ verified banner
    var otpHeader  = $$('signupOtpHeader');
    var otpFormCard = $$('signupOtpFormCard');
    var banner     = $$('signupVerifiedBanner');

    if (otpHeader)   otpHeader.style.display   = 'none';
    if (otpFormCard) otpFormCard.style.display  = 'none';
    if (banner)      banner.style.display       = '';

    // After a short pause, transition to the name step
    setTimeout(function () {
      var otpStep  = $$('signupOtpStep');
      var nameStep = $$('signupNameStep');
      if (otpStep)  otpStep.style.display  = 'none';
      if (nameStep) {
        nameStep.style.display = '';
        var ni = $$('signupNameInput'); if (ni) ni.focus();
      }
    }, 900);
  }

  // ── Save name and complete signup ────────────────────────────
  function handleSaveName() {
    var ni   = $$('signupNameInput');
    var name = ni ? ni.value.trim() : '';
    if (!name) {
      setError('signupNameError', 'Please enter your name.');
      return;
    }

    setError('signupNameError', '');
    setLoading('signupSaveNameBtn', true, 'Creating account');

    var user = firebase.auth().currentUser;
    if (!user) {
      setLoading('signupSaveNameBtn', false, 'Create Account →');
      return;
    }

    var phone = sessionStorage.getItem('signup_phone') || '';
    user.updateProfile({ displayName: name })
      .then(function () {
        sessionStorage.removeItem('signup_verification_id');
        sessionStorage.removeItem('signup_phone');
        return firebase.firestore().collection('users').doc(user.uid).set({
          phone:       phone ? ('+91' + phone) : '',
          displayName: name,
          createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      })
      .then(function () {
        if (sessionStorage.getItem('tlFlow') === '1') {
          sessionStorage.removeItem('tlFlow');
          var lastPage = sessionStorage.getItem('tlLastPage') || '/temp-license';
          sessionStorage.removeItem('tlLastPage');
          window.location.href = lastPage;
        } else {
          window.location.href = '/about-business';
        }
      })
      .catch(function (err) {
        console.error('[FOSCOS] updateProfile:', err);
        setError('signupNameError', 'Could not save name. Try again.');
        setLoading('signupSaveNameBtn', false, 'Create Account →');
      });
  }

  // ── Resend OTP (mock — just restart the timer) ───────────────
  function handleResendOtp() {
    if (!sessionStorage.getItem('signup_phone')) { window.location.href = '/signup'; return; }
    setError('signupOtpError', '');
    startResendTimer();
  }

  function startResendTimer() {
    var secs = 30;
    var rb = $$('signupResendBtn'), rt = $$('signupResendTimer');
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

  // ── Init ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Guard: if no phone in session, send back to signup
    if (!sessionStorage.getItem('signup_phone')) {
      window.location.href = '/signup';
      return;
    }

    // Display masked phone
    var phone = sessionStorage.getItem('signup_phone') || '';
    var disp  = $$('signupOtpPhone');
    if (disp && phone) disp.textContent = '+91 XXXXX' + phone.slice(5);

    // Start resend countdown
    startResendTimer();

    // Focus first digit
    var first = document.querySelector('.signup-otp-digit');
    if (first) first.focus();

    // Wire up buttons
    var vob = $$('signupVerifyOtpBtn');
    if (vob) vob.addEventListener('click', handleVerifyOtp);

    var rb = $$('signupResendBtn');
    if (rb) rb.addEventListener('click', function (e) { e.preventDefault(); handleResendOtp(); });

    var snb = $$('signupSaveNameBtn');
    if (snb) snb.addEventListener('click', handleSaveName);

    var ni = $$('signupNameInput');
    if (ni) ni.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSaveName(); });

    setupOtpInputs();
  });

})();
