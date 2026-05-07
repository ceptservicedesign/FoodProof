/* ============================================================
   TL_ISSUED.JS — P21 License issued screen
   ============================================================ */
(function () {
  'use strict';

  function fmt(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function daysRemaining(expiryIso) {
    if (!expiryIso) return '—';
    var diff = new Date(expiryIso).getTime() - Date.now();
    var days = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
    return String(days);
  }

  function populate() {
    var licenseNo = sessionStorage.getItem('tlLicenseNo') || '';
    var issuedAt  = sessionStorage.getItem('tlIssuedAt')  || '';
    var expiresAt = sessionStorage.getItem('tlExpiresAt') || '';
    var details   = JSON.parse(sessionStorage.getItem('tlDetails') || '{}');

    var bizName = details.bizName ||
      ((details.name || '') + (details.area ? ', ' + details.area : ''));

    var el = function (id) { return document.getElementById(id); };
    if (el('issuedLicenseNo')) el('issuedLicenseNo').textContent = licenseNo || 'TL-2026-···-······';
    if (el('issuedBizName'))   el('issuedBizName').textContent   = bizName   || '—';
    if (el('issuedDate'))      el('issuedDate').textContent      = fmt(issuedAt);
    if (el('issuedExpiry'))    el('issuedExpiry').textContent    = fmt(expiresAt);
    if (el('issuedDaysLeft'))  el('issuedDaysLeft').textContent  = daysRemaining(expiresAt);
  }

  function applyDaysMode() {
    var days           = parseInt(sessionStorage.getItem('tlDays')) || 60;
    var complianceCard = document.getElementById('issuedComplianceCard');
    var viewStepsBtn   = document.getElementById('issuedViewStepsBtn');
    var dashboardBtn   = document.getElementById('issuedDashboardBtn');
    var upgradeCta     = document.getElementById('issuedUpgradeCta');

    /* All temp licenses: primary CTA is Dashboard, not View Steps */
    if (viewStepsBtn) viewStepsBtn.style.display = 'none';
    if (dashboardBtn) dashboardBtn.style.display = '';

    /* 30-day only: hide compliance card, show expand CTA */
    if (days === 30) {
      if (complianceCard) complianceCard.style.display = 'none';
      if (upgradeCta)     upgradeCta.style.display     = '';
    }
  }

  function handleDownload() {
    var licenseNo = sessionStorage.getItem('tlLicenseNo') || 'TL-2026-XXX-000000';
    var issuedAt  = sessionStorage.getItem('tlIssuedAt')  || '';
    var expiresAt = sessionStorage.getItem('tlExpiresAt') || '';
    var days      = parseInt(sessionStorage.getItem('tlDays')) || 60;
    var details   = JSON.parse(sessionStorage.getItem('tlDetails') || '{}');

    var bizName   = details.bizName ||
      ((details.name || '') + (details.area ? ', ' + details.area : '')) || '—';
    var ownerName = details.name     || '—';
    var area      = details.area     ||
      (details.district && details.state ? details.district + ', ' + details.state : '—');
    var licType   = days === 30
      ? '30-Day Stall / Event License'
      : '60-Day Business Setup License';

    var html =
      '<!DOCTYPE html><html><head>' +
      '<meta charset="UTF-8">' +
      '<title>FSSAI Temporary License ' + licenseNo + '</title>' +
      '<style>' +
      'body{font-family:Georgia,serif;max-width:580px;margin:36px auto;color:#1c2b4a;padding:20px}' +
      '.border{border:3px double #1c2b4a;padding:28px}' +
      '.hdr{text-align:center;border-bottom:2px solid #c8813a;padding-bottom:14px;margin-bottom:18px}' +
      '.issuer{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#666}' +
      '.type{font-size:19px;font-weight:bold;margin:4px 0}' +
      '.badge{display:inline-block;background:#c8813a;color:#fff;font-size:10px;font-weight:bold;padding:2px 9px;border-radius:3px;letter-spacing:1px;text-transform:uppercase}' +
      '.num{font-family:monospace;font-size:22px;font-weight:bold;letter-spacing:3px;text-align:center;margin:16px 0;background:#f5f0e8;padding:10px;border-radius:4px}' +
      '.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e0ddd5;font-size:13px}' +
      '.lab{color:#666;font-style:italic}' +
      '.ftr{text-align:center;margin-top:18px;font-size:10px;color:#999;line-height:1.5}' +
      '@media print{body{margin:0;padding:0}.border{border:2px solid #000}}' +
      '</style></head><body>' +
      '<div class="border">' +
      '<div class="hdr">' +
      '<div class="issuer">Food Safety and Standards Authority of India</div>' +
      '<div class="type">Temporary Food Business License</div>' +
      '<div style="margin-top:8px"><span class="badge">Active</span></div>' +
      '</div>' +
      '<div class="num">' + licenseNo + '</div>' +
      '<div class="row"><span class="lab">Business / Stall Name</span><span>' + bizName + '</span></div>' +
      '<div class="row"><span class="lab">Owner Name</span><span>' + ownerName + '</span></div>' +
      '<div class="row"><span class="lab">Location</span><span>' + area + '</span></div>' +
      '<div class="row"><span class="lab">License Type</span><span>' + licType + '</span></div>' +
      '<div class="row"><span class="lab">Date of Issue</span><span>' + fmt(issuedAt) + '</span></div>' +
      '<div class="row" style="border-bottom:none"><span class="lab">Valid Until</span><span><strong>' + fmt(expiresAt) + '</strong></span></div>' +
      '<div class="ftr">This is a computer-generated document issued under the Food Safety and Standards Act, 2006.<br>Valid only for the period specified above. Verify at www.fssai.gov.in.</div>' +
      '</div>' +
      '</body></html>';

    var w = window.open('', '_blank', 'width=700,height=900');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(function () { w.print(); }, 400);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    populate();
    applyDaysMode();
    var btn = document.getElementById('downloadBtn');
    if (btn) btn.addEventListener('click', handleDownload);
  });

  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) {
        sessionStorage.setItem('tlLastPage', window.location.pathname);
        sessionStorage.setItem('tlFlow', '1');
        window.location.href = '/signup';
        return;
      }
      var licenseNo = sessionStorage.getItem('tlLicenseNo');
      if (!licenseNo) {
        firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
          if (doc.exists) {
            var tl = doc.data().tempLicense || {};
            if (tl.licenseNo)  sessionStorage.setItem('tlLicenseNo',  tl.licenseNo);
            if (tl.issuedAt)   sessionStorage.setItem('tlIssuedAt',   tl.issuedAt);
            if (tl.expiresAt)  sessionStorage.setItem('tlExpiresAt',  tl.expiresAt);
            if (tl.details)    sessionStorage.setItem('tlDetails',    JSON.stringify(tl.details));
            if (tl.days)       sessionStorage.setItem('tlDays',       String(tl.days));
            populate();
            applyDaysMode();
          }
        });
      }
    });
  });

})();
