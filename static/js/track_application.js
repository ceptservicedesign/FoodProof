/* ============================================================
   TRACK_APPLICATION.JS — P25 Application status tracker
   ============================================================ */
(function () {
  'use strict';

  var PIPELINE_STEPS = [
    { key: 'submitted',            label: 'Application Submitted',   icon: '📋' },
    { key: 'documents_requested',  label: 'Document Review',          icon: '📄' },
    { key: 'inspection_scheduled', label: 'Inspection Scheduled',    icon: '📅' },
    { key: 'inspection_complete',  label: 'Inspection Complete',     icon: '✅' },
    { key: 'final_review',         label: 'Final Review',            icon: '🔍' },
    { key: 'approved',             label: 'Approved',                icon: '🎉' }
  ];

  var STATUS_ORDER = PIPELINE_STEPS.map(function (s) { return s.key; });

  var DOC_NAMES = {
    idProof:         'Identity Proof',
    addressProof:    'Address Proof',
    form9:           'Form IX',
    blueprint:       'Premises Blueprint',
    waterTestReport: 'Water Analysis Report',
    nocFireDept:     'NOC from Fire Department',
    medicalCert:     'Medical Certificate'
  };

  var currentUid   = null;
  var currentAppId = null;

  // ── Tab switching ─────────────────────────────────────────────
  function setupTabs() {
    document.querySelectorAll('.track-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.track-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.track-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('tab-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ── Render flag notifications ────────────────────────────────
  function renderFlagNotifications(appData) {
    var container = document.getElementById('trackFlagNotifications');
    if (!container) return;
    var flags = appData.flags || [];
    if (!flags.length) { container.innerHTML = ''; return; }

    container.innerHTML = flags.map(function (f) {
      var title = f.issueType || 'Application Flagged';
      var ts    = f.timestamp
        ? new Date(f.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
      return '<div class="track-flag-notif">' +
        '<div class="track-flag-notif__icon">&#9888;&#65039;</div>' +
        '<div class="track-flag-notif__body">' +
          '<div class="track-flag-notif__title">Issue flagged: ' + title +
            (ts ? ' &middot; ' + ts : '') + '</div>' +
          (f.priority ? '<div class="track-flag-notif__meta">Priority: ' + f.priority + '</div>' : '') +
          (f.note ? '<div class="track-flag-notif__msg">' + f.note + '</div>' : '') +
          '<div class="track-flag-notif__action">Please review your documents and resubmit. Upload updated files in the Document Processing tab or use the button below.</div>' +
          '<a href="/modify-license" class="fbo-btn-primary" style="display:inline-block;margin-top:10px;font-size:13px;padding:9px 20px;text-decoration:none;">Modify &amp; Resubmit &#8594;</a>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  // ── Render Application Status timeline ───────────────────────
  function renderTimeline(appData) {
    var container = document.getElementById('trackTimeline');
    if (!container) return;

    var currentStatus = appData.applicationStatus || 'submitted';
    var currentIdx    = STATUS_ORDER.indexOf(currentStatus);
    if (currentIdx === -1) currentIdx = 0;

    var auditMap = {};
    if (appData.auditTrail && appData.auditTrail.length) {
      appData.auditTrail.forEach(function (entry) {
        if (entry.statusKey) auditMap[entry.statusKey] = entry;
      });
    }

    container.innerHTML = '';

    PIPELINE_STEPS.forEach(function (step, idx) {
      var isDone   = idx < currentIdx || (currentStatus === 'approved' && idx === PIPELINE_STEPS.length - 1);
      var isActive = idx === currentIdx;

      var div = document.createElement('div');
      div.className = 'track-timeline__step' + (isDone ? ' done' : '') + (isActive ? ' active' : '');

      var dotContent = isDone ? '✓' : (isActive ? step.icon : '');
      var dateStr = '';
      var entry   = auditMap[step.key];
      if (entry && entry.timestamp) {
        var d = new Date(entry.timestamp);
        dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }

      var noteHtml = '';
      if (isActive && entry && entry.note) {
        noteHtml = '<div class="track-timeline__note">Officer note: ' + entry.note + '</div>';
      }
      if (isActive && appData.lastOfficerNote) {
        noteHtml = '<div class="track-timeline__note">Officer note: ' + appData.lastOfficerNote + '</div>';
      }

      div.innerHTML =
        '<div class="track-timeline__dot">' + dotContent + '</div>' +
        '<div class="track-timeline__body">' +
          '<div class="track-timeline__label">' + step.label + '</div>' +
          (dateStr ? '<div class="track-timeline__date">' + dateStr + '</div>' : '') +
          noteHtml +
        '</div>';

      container.appendChild(div);
    });
  }

  // ── Upload row factory ────────────────────────────────────────
  function makeUploadRow(docKey) {
    var wrap = document.createElement('div');
    wrap.className = 'track-doc-upload';

    var btn = document.createElement('span');
    btn.className = 'track-doc-upload__btn';
    btn.textContent = '⬆ Upload';

    var input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*,.pdf';
    input.style.display = 'none';

    var statusEl = document.createElement('span');
    statusEl.className     = 'track-doc-upload__success';
    statusEl.style.display = 'none';

    btn.addEventListener('click', function () { input.click(); });

    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file || !currentUid || !currentAppId) return;

      btn.textContent = '⏳ Uploading…';
      statusEl.style.display = 'none';

      var path = 'documents/' + currentUid + '/' + docKey + '_' + Date.now();
      var ref  = firebase.storage().ref(path);

      ref.put(file).then(function () {
        return ref.getDownloadURL();
      }).then(function (url) {
        var ts    = firebase.firestore.FieldValue.serverTimestamp();
        var patch = {};
        patch['documents.' + docKey] = url;
        patch['updatedAt'] = ts;

        var auditEntry = {
          action:    'Document uploaded by FBO: ' + (DOC_NAMES[docKey] || docKey),
          by:        'fbo',
          statusKey: 'documents_requested',
          timestamp: new Date().toISOString()
        };

        var db    = firebase.firestore();
        var batch = db.batch();
        batch.set(db.collection('users').doc(currentUid), patch, { merge: true });
        batch.update(db.collection('applications').doc(currentAppId), Object.assign({}, patch, {
          auditTrail: firebase.firestore.FieldValue.arrayUnion(auditEntry)
        }));
        return batch.commit();
      }).then(function () {
        btn.textContent        = '✓ Re-upload';
        statusEl.style.display = '';
        statusEl.style.color   = '';
        statusEl.textContent   = '✓ ' + file.name + ' saved';
      }).catch(function (err) {
        console.error('[track-application] upload ' + docKey + ':', err);
        btn.textContent        = '⬆ Upload';
        statusEl.style.display = '';
        statusEl.style.color   = '#b91c1c';
        statusEl.textContent   = 'Upload failed — please try again';
      });
    });

    wrap.appendChild(btn);
    wrap.appendChild(input);
    wrap.appendChild(statusEl);
    return wrap;
  }

  // ── Render Document Processing tab ───────────────────────────
  function renderDocProcessing(appData) {
    var container = document.getElementById('trackDocGrid');
    if (!container) return;

    var docs      = appData.documents || {};
    var ossCart   = (appData.ossCart && appData.ossCart.items) ? appData.ossCart.items : [];

    container.innerHTML = '';
    var hasAny = false;

    // Submitted docs
    Object.keys(DOC_NAMES).forEach(function (key) {
      if (!docs[key]) return;
      hasAny = true;
      var item = document.createElement('div');
      item.className = 'track-doc-item';
      item.innerHTML =
        '<span class="track-doc-item__name">' + DOC_NAMES[key] + '</span>' +
        '<span class="track-badge track-badge--verified">Submitted</span>';
      container.appendChild(item);
    });

    // Scheduled water test bookings
    var waterBooked = ossCart.filter(function (i) { return i.id && i.id.indexOf('water-') === 0; });
    waterBooked.forEach(function (booking) {
      if (docs.waterTestReport) return;
      hasAny = true;
      var dateStr = booking.date
        ? new Date(booking.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : '';
      var item = document.createElement('div');
      item.className = 'track-doc-item';
      item.innerHTML =
        '<span class="track-doc-item__name">Water Analysis Report' +
          '<span class="track-doc-item__sub">' +
            (booking.name || '') +
            (dateStr ? ' &middot; ' + dateStr : '') +
            (booking.time ? ' at ' + booking.time : '') +
          '</span></span>' +
        '<span class="track-badge track-badge--scheduled">Scheduled</span>';
      container.appendChild(item);
      container.appendChild(makeUploadRow('waterTestReport'));
    });

    // Scheduled medical cert bookings
    var medBooked = ossCart.filter(function (i) { return i.id && i.id.indexOf('medical-') === 0; });
    medBooked.forEach(function (booking) {
      hasAny = true;
      var dateStr = booking.date
        ? new Date(booking.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : '';
      var item = document.createElement('div');
      item.className = 'track-doc-item';
      item.innerHTML =
        '<span class="track-doc-item__name">Medical Certificate' +
          '<span class="track-doc-item__sub">' +
            (booking.name || '') +
            (dateStr ? ' &middot; ' + dateStr : '') +
            (booking.time ? ' at ' + booking.time : '') +
          '</span></span>' +
        '<span class="track-badge track-badge--scheduled">Scheduled</span>';
      container.appendChild(item);
      container.appendChild(makeUploadRow('medicalCert'));
    });

    // Pending water test (not submitted, not scheduled via OSS)
    if (!docs.waterTestReport && !waterBooked.length) {
      hasAny = true;
      var pendItem = document.createElement('div');
      pendItem.className = 'track-doc-item';
      pendItem.innerHTML =
        '<span class="track-doc-item__name">Water Analysis Report</span>' +
        '<span class="track-badge track-badge--missing">Pending</span>';
      container.appendChild(pendItem);
      container.appendChild(makeUploadRow('waterTestReport'));
    }

    if (!hasAny) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No documents on record.</div>';
    }
  }

  // ── Render Inspection tab ─────────────────────────────────────
  function renderInspection(appData) {
    var panel = document.getElementById('trackInspectionPanel');
    if (!panel) return;

    var status = appData.applicationStatus || '';
    if (status === 'inspection_scheduled' || status === 'inspection_complete') {
      var entry = null;
      if (appData.auditTrail) {
        appData.auditTrail.forEach(function (e) {
          if (e.statusKey === 'inspection_scheduled') entry = e;
        });
      }
      var dateStr = entry && entry.timestamp
        ? new Date(entry.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Date not set';

      panel.innerHTML =
        '<div class="big-icon">📅</div>' +
        '<div class="title">Inspection ' + (status === 'inspection_complete' ? 'Completed' : 'Scheduled') + '</div>' +
        '<div class="sub">Scheduled on: ' + dateStr + '.<br>' +
        (entry && entry.note ? 'Note: ' + entry.note : 'An FSSAI officer will visit your premises.') + '</div>';
    }
  }

  // ── Load data from Firestore ──────────────────────────────────
  function loadTrackData(user) {
    currentUid = user.uid;
    firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
      if (!doc.exists) { window.location.href = '/fbo-portal'; return; }
      var d   = doc.data();
      var appId = d.applicationId;
      currentAppId = appId || null;

      if (!appId) { window.location.href = '/fbo-portal'; return; }

      var sub = document.getElementById('trackSubHeading');
      if (sub) {
        var tier = d.scale && d.scale.tier;
        var tierMap = {
          'temporary-basic': 'Basic Registration',
          'basic':           'State License (Basic)',
          'state':           'State License',
          'central':         'Central License'
        };
        sub.textContent = appId + ' · ' + (tierMap[tier] || 'License') +
          (d.submittedAt && d.submittedAt.toDate
            ? ' · Filed ' + d.submittedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '');
      }

      firebase.firestore().collection('applications').doc(appId).get().then(function (appDoc) {
        var appData = appDoc.exists ? appDoc.data() : d;
        renderFlagNotifications(appData);
        renderTimeline(appData);
        renderDocProcessing(appData);
        renderInspection(appData);
      }).catch(function () {
        renderTimeline(d);
        renderDocProcessing(d);
      });
    }).catch(function () {
      window.location.href = '/fbo-portal';
    });
  }

  // ── Auth guard ────────────────────────────────────────────────
  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }
      loadTrackData(user);
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    setupTabs();

    var enrolBtn = document.getElementById('fostacEnrolBtn');
    if (enrolBtn) {
      enrolBtn.addEventListener('click', function () {
        enrolBtn.disabled    = true;
        enrolBtn.textContent = 'Submitting…';
        setTimeout(function () {
          enrolBtn.style.display = 'none';
          var success = document.getElementById('fostacEnrolSuccess');
          if (success) success.style.display = '';
        }, 800);
      });
    }

    var certInput = document.getElementById('fostacCertInput');
    if (certInput) {
      certInput.addEventListener('change', function () {
        var file = certInput.files[0];
        if (!file) return;
        var success = document.getElementById('fostacUploadSuccess');
        if (success) {
          success.textContent = '✓ ' + file.name + ' uploaded and added to your application.';
          success.style.display = '';
        }
      });
    }
  });

})();
