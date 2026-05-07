(function () {
  'use strict';

  var PENDING_STATUSES = [
    'submitted', 'pending',
    'documents_requested', 'inspection_scheduled',
    'inspection_complete', 'final_review'
  ];

  var TIER_LABELS = {
    'temporary-basic': 'Temporary / Basic Registration',
    'basic':           'Basic Registration',
    'state':           'State License',
    'central':         'Central License'
  };

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  }

  /* ── Pending display ─────────────────────────────────────── */

  function showPending(d) {
    document.getElementById('fboLoadingView').style.display  = 'none';
    document.getElementById('fboApprovedView').style.display = 'none';
    document.getElementById('fboPendingView').style.display  = '';

    var name = (d.details && d.details.bizName) || 'Applicant';
    var docsRequested = d.applicationStatus === 'documents_requested';

    setText('pendingGreeting',   'Hi ' + name.split(' ')[0] + (docsRequested ? ' — Action Required' : ' — Application Under Review'));
    setText('pendingAppId',      d.applicationId);
    setText('pendingAppIdBadge', d.applicationId);
    setText('hist-appId',        d.applicationId);

    var statusMap = {
      submitted:            'Submitted',
      pending:              'Under Review',
      documents_requested:  'Docs Requested',
      inspection_scheduled: 'Inspection Scheduled',
      inspection_complete:  'Inspection Done',
      final_review:         'Final Review'
    };
    setText('hist-status', statusMap[d.applicationStatus] || 'Under Review');

    setText('pend-bizName',     d.details && d.details.bizName);
    setText('pend-licenseType', TIER_LABELS[d.scale && d.scale.tier] || '—');
    var years = d.review && d.review.years;
    setText('pend-duration', years ? years + (years === 1 ? ' Year' : ' Years') : '—');
    var fee = d.review && d.review.totalFee;
    setText('pend-fee', fee !== undefined ? '₹' + fee.toLocaleString('en-IN') : '—');

    if (docsRequested) {
      var iconEl  = document.querySelector('#fboPendingView .fbo-status-banner__icon');
      var titleEl = document.querySelector('#fboPendingView .fbo-status-banner__title');
      var subEl   = document.querySelector('#fboPendingView .fbo-status-banner__sub');
      if (iconEl)  iconEl.textContent  = '📄';
      if (titleEl) titleEl.textContent = 'Action required — additional documents requested';
      if (subEl) {
        subEl.textContent = d.lastOfficerNote
          ? 'Officer note: "' + d.lastOfficerNote + '". Please update your details and documents, then resubmit.'
          : 'FSSAI officers have requested additional information. Please update your details and documents, then resubmit.';
      }
    }

    var trackBtn = document.getElementById('pendingTrackBtn');
    if (trackBtn) {
      if (docsRequested) {
        trackBtn.textContent = 'Update & Resubmit →';
        trackBtn.addEventListener('click', function () { window.location.href = '/modify-license'; });
      } else {
        trackBtn.addEventListener('click', function () { window.location.href = '/track-application'; });
      }
    }
  }

  /* ── Approved display ────────────────────────────────────── */

  function showApproved(d) {
    document.getElementById('fboLoadingView').style.display  = 'none';
    document.getElementById('fboPendingView').style.display  = 'none';
    document.getElementById('fboApprovedView').style.display = '';

    var bizName = (d.details && d.details.bizName) || '—';
    setText('approvedGreeting',    'Welcome back 👋');
    setText('approvedBusinessSub', bizName + ' — License Active');
    setText('approvedLicenseId',   d.applicationId || '—');
    setText('appr-bizName',        bizName);
    setText('appr-licenseNo',      d.applicationId || '—');
    setText('appr-appId',          d.applicationId || '—');
    setText('appr-licenseType',    TIER_LABELS[d.scale && d.scale.tier] || '—');

    var addr = d.details
      ? [d.details.addrLine1, d.details.addrDistrict, d.details.addrState].filter(Boolean).join(', ')
      : '—';
    setText('appr-address', addr);

    var submittedAt = d.submittedAt && d.submittedAt.toDate ? d.submittedAt.toDate() : null;
    var years = (d.review && d.review.years) || 1;
    if (submittedAt) {
      var validUntil = new Date(submittedAt);
      validUntil.setFullYear(validUntil.getFullYear() + years);
      setText('appr-validUntil', validUntil.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      }));
    }
  }

  /* ── Boot ────────────────────────────────────────────────── */

  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }

      firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
        if (!doc.exists) { window.location.href = '/about-business'; return; }
        var d = doc.data();

        if (d.applicationStatus === 'approved') {
          showApproved(d);
        } else if (PENDING_STATUSES.indexOf(d.applicationStatus) !== -1 || d.applicationId) {
          showPending(d);
        } else if (d.tempLicense && d.tempLicense.licenseNo) {
          window.location.href = '/temp-license/next-steps';
        } else {
          window.location.href = '/about-business';
        }
      }).catch(function () {
        window.location.href = '/';
      });
    });
  });

})();
