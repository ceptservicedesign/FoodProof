/* ============================================================
   TL_TERMS.JS — P20 Operating rules acknowledgement + T&C
   ============================================================ */
(function () {
  'use strict';

  function $$(id) { return document.getElementById(id); }

  function checkAllBoxes() {
    var boxes  = document.querySelectorAll('.tl-tc-check');
    var allDone = Array.from(boxes).every(function (b) { return b.checked; });
    var btn = $$('tcGetLicense');
    if (btn) btn.disabled = !allDone;
  }

  function generateLicenseNumber(area) {
    var areaCode = (area || 'GEN').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
    var rand = Math.floor(100000 + Math.random() * 900000);
    return 'TL-2026-' + areaCode + '-' + rand;
  }

  function handleGetLicense() {
    var user = firebase.auth().currentUser;
    if (!user) return;

    var btn = $$('tcGetLicense');
    if (btn) { btn.disabled = true; btn.textContent = 'Issuing…'; }

    var details  = JSON.parse(sessionStorage.getItem('tlDetails') || '{}');
    var purpose  = sessionStorage.getItem('tlPurpose') || 'business';
    var days     = parseInt(sessionStorage.getItem('tlDays')) || 60;
    var setup    = sessionStorage.getItem('tlSetup')   || 'other';
    var foods    = JSON.parse(sessionStorage.getItem('tlFoods')  || '[]');
    var annual   = parseFloat(sessionStorage.getItem('tlAnnual') || '0');

    var licenseNo = generateLicenseNumber(details.area);
    var issuedAt  = new Date();
    var expiresAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);

    sessionStorage.setItem('tlLicenseNo',  licenseNo);
    sessionStorage.setItem('tlIssuedAt',   issuedAt.toISOString());
    sessionStorage.setItem('tlExpiresAt',  expiresAt.toISOString());
    sessionStorage.setItem('tlDays',       String(days));

    firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
      var existing = doc.exists ? (doc.data().tempLicense || {}) : {};
      var tlData = {
        licenseNo:   licenseNo,
        status:      'active',
        purpose:     purpose,
        days:        days,
        issuedAt:    issuedAt.toISOString(),
        expiresAt:   expiresAt.toISOString(),
        setup:       setup,
        foods:       foods,
        annualEstimate: annual,
        details:     details,
        docs:        existing.docs   || {},
        photos:      existing.photos || {},
        tcAccepted:  true,
        fostacEnrolled:        false,
        waterTestDone:         false,
        inspectionDone:        false,
        fostacEnrolledPending: false,
        waterTestPending:      false,
        inspectionPending:     false
      };

      return firebase.firestore().collection('users').doc(user.uid).set(
        { tempLicense: tlData }, { merge: true }
      ).then(function () {
        return firebase.firestore().collection('tempApplications').doc(licenseNo).set(
          Object.assign({ userId: user.uid, phone: user.phoneNumber || '' }, tlData)
        );
      });
    }).then(function () {
      window.location.href = '/temp-license/issued';
    }).catch(function (e) {
      console.error('[TL terms]', e);
      window.location.href = '/temp-license/issued';
    });
  }

  function applyDaysMode() {
    var days = parseInt(sessionStorage.getItem('tlDays')) || 60;
    if (days !== 30) return;

    var titleEl  = $$('tcValidityTitle');
    var descEl   = $$('tcValidityDesc');
    var tc3Label = $$('tc3Label');
    var tc3      = $$('tc3');

    if (titleEl) titleEl.textContent = 'Valid for 30 Days Only';
    if (descEl)  descEl.textContent  = 'This license is valid for 30 days from the date of issue. You must cease operations after expiry.';
    if (tc3Label) tc3Label.style.display = 'none';
    if (tc3) tc3.checked = true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyDaysMode();
    document.querySelectorAll('.tl-tc-check').forEach(function (box) {
      box.addEventListener('change', checkAllBoxes);
    });
    var btn = $$('tcGetLicense');
    if (btn) btn.addEventListener('click', handleGetLicense);
  });

  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) {
        sessionStorage.setItem('tlLastPage', window.location.pathname);
        sessionStorage.setItem('tlFlow', '1');
        window.location.href = '/signup';
      }
    });
  });

})();
