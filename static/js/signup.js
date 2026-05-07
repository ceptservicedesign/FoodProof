/* ============================================================
   SIGNUP.JS — /signup page (P04): phone entry → navigate to verify
   Mock OTP flow: no reCAPTCHA, no Firebase SMS.
   ============================================================ */
(function () {
  'use strict';

  function $$(id) { return document.getElementById(id); }

  function setError(msg) {
    var el = $$('signupPhoneError'); if (el) el.textContent = msg;
  }

  function handleSendOtp() {
    var pi    = $$('signupPhoneInput');
    var phone = pi ? pi.value.trim().replace(/\D/g, '') : '';
    setError('');
    if (phone.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    sessionStorage.setItem('signup_phone', phone);
    window.location.href = '/signup/verify';
  }

  // Redirect already-logged-in users away from signup
  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) return;
      if (sessionStorage.getItem('tlFlow') === '1') {
        sessionStorage.removeItem('tlFlow');
        var lastPage = sessionStorage.getItem('tlLastPage') || '/temp-license';
        sessionStorage.removeItem('tlLastPage');
        window.location.href = lastPage;
      } else {
        window.location.href = '/fbo-portal';
      }
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    var btn = $$('signupSendOtpBtn');
    if (btn) btn.addEventListener('click', handleSendOtp);

    var pi = $$('signupPhoneInput');
    if (pi) pi.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSendOtp();
    });

    var strip = $$('tlInfoStrip');
    if (strip) {
      strip.addEventListener('click', function () {
        sessionStorage.setItem('tlFlow', '1');
        strip.classList.add('signup-info-strip--selected');
        var msg = $$('tlInfoStripMsg');
        if (msg) msg.textContent = '✓ After sign-in you\'ll be directed to Instant License';
      });

      if (sessionStorage.getItem('tlFlow') === '1') {
        strip.classList.add('signup-info-strip--selected');
        var msg = $$('tlInfoStripMsg');
        if (msg) msg.textContent = '✓ After sign-in you\'ll be directed to Instant License';
      }
    }
  });

})();
