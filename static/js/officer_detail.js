/* ============================================================
   OFFICER_DETAIL.JS — P30 Application detail: tabs, pipeline, actions
   ============================================================ */
(function () {
  'use strict';

  var appId   = window.__APP_ID__;
  var appData = null;
  var pendingAction = null;

  var STATUS_LABELS = {
    submitted:            'Submitted',
    documents_requested:  'Docs Requested',
    inspection_scheduled: 'Inspection Scheduled',
    inspection_complete:  'Inspection Complete',
    final_review:         'Final Review',
    approved:             'Approved',
    rejected:             'Rejected'
  };

  var TIER_LABELS = {
    'temporary-basic': 'Basic Registration',
    'basic':           'State License (Basic)',
    'state':           'State License',
    'central':         'Central License'
  };

  var DOC_NAMES = {
    selfie:          'Photo of Applicant',
    idProof:         'Identity Proof',
    addressProof:    'Address Proof',
    form9:           'Form IX',
    blueprint:       'Premises Blueprint',
    waterTestReport: 'Water Analysis Report',
    nocFireDept:     'NOC from Fire Department'
  };

  var PIPELINE_ORDER = [
    'submitted', 'documents_requested', 'inspection_scheduled',
    'inspection_complete', 'final_review', 'approved'
  ];

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTime(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Pipeline ──────────────────────────────────────────────────
  function renderPipeline(status) {
    var steps = document.querySelectorAll('#detailPipeline .officer-pipeline__step');
    var currentIdx = PIPELINE_ORDER.indexOf(status);

    steps.forEach(function (step) {
      var s   = step.getAttribute('data-step');
      var idx = PIPELINE_ORDER.indexOf(s);
      step.classList.remove('active', 'done');
      if (s === status) {
        step.classList.add('active');
      } else if (status !== 'rejected' && idx < currentIdx) {
        step.classList.add('done');
      }
    });
  }

  // ── Status badge ──────────────────────────────────────────────
  function renderStatusBadge(status) {
    var el = document.getElementById('currentStatusBadge');
    if (!el) return;
    el.textContent = STATUS_LABELS[status] || status;
    el.className   = 'officer-status-badge-lg officer-badge officer-badge--' + (status || '');
  }

  // ── Meta sidebar ──────────────────────────────────────────────
  function renderMeta(d) {
    setText('metaSubmitted', formatDate(d.submittedAt));
    setText('metaUpdated',   formatDate(d.updatedAt));
    setText('metaTier',      TIER_LABELS[d.tier] || d.tier || '—');
    setText('metaFee',       d.fee ? ('₹' + (d.fee * (d.years || 1)).toLocaleString('en-IN')) : '—');
  }

  // ── Business Info tab ─────────────────────────────────────────
  function renderBusinessInfo(d) {
    var det   = d.details || {};
    var scale = d.scale   || {};
    var grid  = document.getElementById('businessInfoGrid');
    if (!grid) return;

    var addr = [det.addrLine1, det.addrDistrict, det.addrState, det.addrPincode].filter(Boolean).join(', ');

    grid.innerHTML = [
      infoItem('Phone',            d.phone   || '—'),
      infoItem('Business Name',    det.bizName   || '—'),
      infoItem('Owner Name',       det.ownerName || '—'),
      infoItem('License Type',     TIER_LABELS[d.tier] || d.tier || '—'),
      infoItem('Annual Fee',       d.fee ? '₹' + Number(d.fee).toLocaleString('en-IN') : '—'),
      infoItem('Duration',         d.years ? d.years + ' Year' + (d.years > 1 ? 's' : '') : '—'),
      infoItem('State',            det.addrState    || '—'),
      infoItem('District',         det.addrDistrict || '—'),
      infoItem('Pincode',          det.addrPincode  || '—'),
      infoItemFull('Business Types', (d.businessTypes || []).join(', ') || '—'),
      infoItemFull('Food Types',     (d.foodTypes     || []).join(', ') || '—'),
      infoItemFull('Address',        addr || '—')
    ].join('');
  }

  function infoItem(label, value) {
    return '<div class="officer-info-item">' +
      '<span class="officer-info-item__label">' + esc(label) + '</span>' +
      '<span class="officer-info-item__value">' + esc(value) + '</span>' +
      '</div>';
  }

  function infoItemFull(label, value) {
    return '<div class="officer-info-item officer-info-item--full">' +
      '<span class="officer-info-item__label">' + esc(label) + '</span>' +
      '<span class="officer-info-item__value">' + esc(value) + '</span>' +
      '</div>';
  }

  // ── Documents tab ─────────────────────────────────────────────
  function renderDocuments(d) {
    var docs = d.documents || {};
    var tier = d.tier || 'basic';
    var list = document.getElementById('documentsList');
    if (!list) return;

    var required = [];
    if (tier !== 'temporary-basic') required.push('idProof', 'addressProof', 'waterTestReport');
    if (tier === 'state' || tier === 'central') required.push('form9', 'blueprint');
    if (tier === 'central') required.push('nocFireDept');

    list.innerHTML = required.map(function (key) {
      var val     = docs[key];
      var isUrl   = typeof val === 'string' && val.indexOf('http') === 0;
      var isBool  = val === true;
      var present = isUrl || isBool;

      var statusHtml;
      if (isUrl) {
        statusHtml = '<a href="' + esc(val) + '" target="_blank" rel="noopener" class="officer-doc-download">Download ↗</a>';
      } else if (isBool) {
        statusHtml = '<span class="officer-doc-item__status officer-doc-item__status--present">Uploaded (no link)</span>';
      } else {
        statusHtml = '<span class="officer-doc-item__status officer-doc-item__status--missing">Missing</span>';
      }

      return '<div class="officer-doc-item">' +
        '<div>' +
          '<div class="officer-doc-item__name">' + esc(DOC_NAMES[key] || key) + '</div>' +
        '</div>' +
        statusHtml +
        '</div>';
    }).join('');
  }

  // ── Audit trail tab ───────────────────────────────────────────
  function renderAudit(d) {
    var trail = d.auditTrail || [];
    var list  = document.getElementById('auditList');
    if (!list) return;

    if (!trail.length) {
      list.innerHTML = '<p class="officer-info-loading">No audit entries.</p>';
      return;
    }

    list.innerHTML = trail.slice().reverse().map(function (entry) {
      var ts = entry.timestamp
        ? (entry.timestamp.toDate ? formatDateTime(entry.timestamp) : new Date(entry.timestamp).toLocaleString('en-IN'))
        : '—';
      return '<div class="officer-audit-item">' +
        '<div class="officer-audit-item__dot"></div>' +
        '<div>' +
          '<div class="officer-audit-item__action">' + esc(entry.action) + '</div>' +
          '<div class="officer-audit-item__meta">By ' + esc(entry.by || '—') + ' &bull; ' + ts + '</div>' +
          (entry.note ? '<div class="officer-audit-item__note">' + esc(entry.note) + '</div>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  }

  // ── Inspection tab ────────────────────────────────────────────
  var INSPECTION_STATUSES = ['inspection_scheduled', 'inspection_complete', 'final_review', 'approved'];

  function renderInspection(d) {
    var wrap = document.getElementById('inspectionPanel');
    if (!wrap) return;
    var status = d.applicationStatus || '';
    var rec    = d.inspectionRecord;

    if (INSPECTION_STATUSES.indexOf(status) === -1) {
      wrap.innerHTML = '<p class="officer-info-loading">Inspection is not yet scheduled — application has not reached the Inspection stage.</p>';
      return;
    }

    var formHtml =
      '<div class="officer-inspection-form" id="inspectionForm">' +
        '<div class="officer-modal__field">' +
          '<label>Inspection Date</label>' +
          '<input type="date" id="inspDateInput" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;" />' +
        '</div>' +
        '<div class="officer-modal__field">' +
          '<label>Officer Assigned</label>' +
          '<input type="text" id="inspOfficerInput" placeholder="Officer name…" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;" />' +
        '</div>' +
        '<div class="officer-modal__field">' +
          '<label>Inspection Notes</label>' +
          '<textarea id="inspNotesInput" rows="3" placeholder="Pre-inspection notes, checklist items…" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;resize:vertical;"></textarea>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-top:4px;">' +
          '<button class="officer-modal__confirm" id="inspSaveBtn">Save Inspection Details</button>' +
          '<span id="inspSavedMsg" style="font-size:13px;color:#16a34a;font-weight:600;display:none;">✔ Saved</span>' +
        '</div>' +
      '</div>';

    if (rec) {
      wrap.innerHTML =
        '<div class="officer-info-grid" style="margin-bottom:20px">' +
          infoItem('Scheduled Date',    rec.date     || '—') +
          infoItem('Assigned Officer',  rec.officer  || '—') +
          infoItem('Saved By',          rec.savedBy  || '—') +
          infoItemFull('Notes',         rec.notes    || '—') +
        '</div>' +
        '<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Update inspection details below:</p>' +
        formHtml;
      document.getElementById('inspDateInput').value    = rec.date    || '';
      document.getElementById('inspOfficerInput').value = rec.officer || '';
      document.getElementById('inspNotesInput').value   = rec.notes   || '';
    } else {
      wrap.innerHTML =
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">This application is at the Inspection stage. Record the inspection details below.</p>' +
        formHtml;
    }

    document.getElementById('inspSaveBtn').addEventListener('click', saveInspection);
  }

  function saveInspection() {
    var dateVal    = (document.getElementById('inspDateInput').value   || '').trim();
    var officerVal = (document.getElementById('inspOfficerInput').value || '').trim();
    var notesVal   = (document.getElementById('inspNotesInput').value   || '').trim();
    var btn        = document.getElementById('inspSaveBtn');
    var msg        = document.getElementById('inspSavedMsg');

    if (!dateVal) { alert('Please select an inspection date.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Saving…';

    var rec = {
      date:      dateVal,
      officer:   officerVal || 'FSO',
      notes:     notesVal,
      savedBy:   'officer',
      savedAt:   firebase.firestore.FieldValue.serverTimestamp()
    };

    var auditEntry = {
      action:    'Inspection details recorded — ' + dateVal,
      by:        officerVal || 'officer',
      statusKey: 'inspection_scheduled',
      timestamp: new Date().toISOString()
    };

    firebase.firestore().collection('applications').doc(appId).update({
      inspectionRecord: rec,
      auditTrail: firebase.firestore.FieldValue.arrayUnion(auditEntry)
    }).then(function () {
      if (appData) appData.inspectionRecord = rec;
      btn.disabled    = false;
      btn.textContent = 'Save Inspection Details';
      if (msg) { msg.style.display = ''; setTimeout(function () { msg.style.display = 'none'; }, 3000); }
    }).catch(function (err) {
      console.error('[officer-detail] inspection save:', err);
      btn.disabled    = false;
      btn.textContent = 'Save Inspection Details';
      alert('Could not save. Please try again.');
    });
  }

  // ── Flags tab ─────────────────────────────────────────────────
  function renderFlags(d) {
    var flags = d.flags || [];
    var list  = document.getElementById('flagsList');
    if (!list) return;

    if (!flags.length) {
      list.innerHTML = '<p class="officer-info-loading">No flags raised.</p>';
      return;
    }

    list.innerHTML = flags.map(function (f) {
      return '<div class="officer-audit-item">' +
        '<div class="officer-audit-item__dot" style="background:#f97316"></div>' +
        '<div>' +
          '<div class="officer-audit-item__action">' + esc(f.issueType || f.reason || 'Flagged') + '</div>' +
          (f.priority ? '<div class="officer-audit-item__meta">Priority: ' + esc(f.priority) + '</div>' : '') +
          '<div class="officer-audit-item__meta">By ' + esc(f.by || '—') + ' &bull; ' + esc(f.timestamp || '—') + '</div>' +
          (f.note ? '<div class="officer-audit-item__note">' + esc(f.note) + '</div>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  }

  // ── Header action buttons ─────────────────────────────────────
  function setupHeaderActions(status) {
    var isFinal = (status === 'approved' || status === 'rejected');

    var advanceBtn = document.getElementById('btnAdvanceStep');
    var approveBtn = document.getElementById('btnApprove');
    var flagBtn    = document.getElementById('btnFlag');
    var returnBtn  = document.getElementById('btnReturn');

    if (isFinal) {
      if (advanceBtn) advanceBtn.style.display = 'none';
      if (approveBtn) approveBtn.style.display = 'none';
      if (flagBtn)    flagBtn.style.display    = 'none';
      if (returnBtn)  returnBtn.style.display  = 'none';
      return;
    }

    var nextIdx    = PIPELINE_ORDER.indexOf(status) + 1;
    var nextStatus = nextIdx < PIPELINE_ORDER.length ? PIPELINE_ORDER[nextIdx] : null;

    if (advanceBtn) {
      if (nextStatus && nextStatus !== 'approved') {
        advanceBtn.addEventListener('click', function () {
          openActionModal('advance', nextStatus);
        });
      } else {
        advanceBtn.style.display = 'none';
      }
    }

    if (approveBtn) {
      approveBtn.addEventListener('click', function () {
        openActionModal('approve', 'approved');
      });
    }

    if (flagBtn) {
      flagBtn.addEventListener('click', openFlagModal);
    }

    if (returnBtn) {
      returnBtn.addEventListener('click', function () {
        openActionModal('docs', 'documents_requested');
      });
    }
  }

  // ── Generic action modal ──────────────────────────────────────
  function openActionModal(action, targetStatus) {
    var LABELS = {
      advance: 'Advance Application',
      docs:    'Return for More Documents',
      approve: 'Approve Application',
      reject:  'Reject Application'
    };
    var BODIES = {
      advance: 'Move this application to the next stage in the review pipeline.',
      docs:    'Request the applicant to submit additional or corrected documents.',
      approve: 'Grant the food safety license for this application.',
      reject:  'Reject this application. This action cannot be undone.'
    };

    document.getElementById('actionModalTitle').textContent = LABELS[action] || 'Confirm';
    document.getElementById('actionModalBody').textContent  = BODIES[action] || '';
    document.getElementById('actionModalNote').value        = '';
    document.getElementById('actionModalError').textContent = '';
    document.getElementById('actionModalOverlay').classList.add('open');

    pendingAction = { action: action, targetStatus: targetStatus };
  }

  function closeActionModal() {
    document.getElementById('actionModalOverlay').classList.remove('open');
    pendingAction = null;
  }

  // ── Flag modal ────────────────────────────────────────────────
  function openFlagModal() {
    document.getElementById('flagIssueType').value = '';
    document.getElementById('flagPriority').value  = 'medium';
    document.getElementById('flagNote').value       = '';
    document.getElementById('flagModalError').textContent = '';
    document.getElementById('flagModalOverlay').classList.add('open');
  }

  function closeFlagModal() {
    document.getElementById('flagModalOverlay').classList.remove('open');
  }

  function executeFlag() {
    var issueType = document.getElementById('flagIssueType').value;
    var priority  = document.getElementById('flagPriority').value;
    var note      = document.getElementById('flagNote').value.trim();
    var errEl     = document.getElementById('flagModalError');
    var confirmBtn = document.getElementById('flagModalConfirm');

    if (!issueType) { errEl.textContent = 'Please select an issue type.'; return; }

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Saving…';
    errEl.textContent      = '';

    var ts         = firebase.firestore.FieldValue.serverTimestamp();
    var flagEntry  = {
      issueType: issueType,
      priority:  priority,
      note:      note || '',
      by:        'officer',
      timestamp: new Date().toISOString()
    };
    var auditEntry = {
      action:    'Application flagged — ' + issueType + ' (' + priority + ' priority)',
      by:        'officer',
      statusKey: 'flagged',
      timestamp: new Date().toISOString()
    };
    if (note) auditEntry.note = note;

    var db    = firebase.firestore();
    var batch = db.batch();

    batch.update(db.collection('applications').doc(appId), {
      updatedAt:  ts,
      flags:      firebase.firestore.FieldValue.arrayUnion(flagEntry),
      auditTrail: firebase.firestore.FieldValue.arrayUnion(auditEntry)
    });

    if (appData && appData.uid) {
      var userUpdate = { updatedAt: ts };
      if (note) userUpdate.lastOfficerNote = note;
      batch.set(db.collection('users').doc(appData.uid), userUpdate, { merge: true });

      var notifMsg = 'Your application has been flagged: ' + issueType +
        (note ? '. Officer note: "' + note + '"' : '') +
        '. Please check Track My Application for details.';

      batch.set(db.collection('notifications').doc(), {
        uid:       appData.uid,
        appId:     appId,
        message:   notifMsg,
        issueType: issueType,
        note:      note || '',
        priority:  priority,
        type:      'flag',
        createdAt: ts,
        read:      false
      });
    }

    batch.commit().then(function () {
      closeFlagModal();
      loadApplication();
    }).catch(function (err) {
      console.error('[FOSCOS] flag action:', err);
      errEl.textContent      = 'Failed to save. Please try again.';
      confirmBtn.disabled    = false;
      confirmBtn.textContent = 'Flag Application';
    });
  }

  // ── Execute generic action ────────────────────────────────────
  function executeAction() {
    if (!pendingAction || !appData) return;

    var note         = document.getElementById('actionModalNote').value.trim();
    var confirmBtn   = document.getElementById('actionModalConfirm');
    var errEl        = document.getElementById('actionModalError');
    var action       = pendingAction.action;
    var targetStatus = pendingAction.targetStatus;

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Saving…';
    errEl.textContent      = '';

    var ts         = firebase.firestore.FieldValue.serverTimestamp();
    var auditEntry = {
      action:    buildAuditLabel(action),
      by:        'officer',
      statusKey: targetStatus,
      timestamp: new Date().toISOString()
    };
    if (note) auditEntry.note = note;

    var update = {
      applicationStatus: targetStatus,
      updatedAt:         ts,
      auditTrail:        firebase.firestore.FieldValue.arrayUnion(auditEntry)
    };

    var db    = firebase.firestore();
    var batch = db.batch();

    batch.update(db.collection('applications').doc(appId), update);

    if (appData.uid) {
      var userUpdate = {
        applicationStatus: targetStatus,
        updatedAt:         ts
      };
      if (note) userUpdate.lastOfficerNote = note;

      batch.set(db.collection('users').doc(appData.uid), userUpdate, { merge: true });

      batch.set(db.collection('notifications').doc(), {
        uid:       appData.uid,
        appId:     appId,
        message:   buildNotifMessage(action, targetStatus),
        type:      action,
        createdAt: ts,
        read:      false
      });
    }

    batch.commit().then(function () {
      closeActionModal();
      loadApplication();
    }).catch(function (err) {
      console.error('[FOSCOS] officer action:', err);
      errEl.textContent      = 'Failed to save. Please try again.';
      confirmBtn.disabled    = false;
      confirmBtn.textContent = 'Confirm';
    });
  }

  function buildAuditLabel(action) {
    var map = {
      advance: 'Application advanced to next stage',
      docs:    'Additional documents requested',
      approve: 'Application approved',
      reject:  'Application rejected'
    };
    return map[action] || action;
  }

  function buildNotifMessage(action) {
    var map = {
      advance: 'Your application has been moved forward in the review process.',
      docs:    'Additional documents have been requested. Please log in to upload.',
      approve: 'Congratulations! Your food safety license application has been approved.',
      reject:  'Your food safety license application has been rejected. Please contact your local FSSAI office.'
    };
    return map[action] || 'Your application status has been updated.';
  }

  // ── Tabs ──────────────────────────────────────────────────────
  var DETAIL_CATEGORY_LABELS = {
    'hygiene':       'Hygiene',
    'food-quality':  'Food Quality',
    'mislabelling':  'Mislabelling',
    'adulteration':  'Adulteration'
  };

  var DETAIL_STATUS_KEYS = {
    'Resolved':             'resolved',
    'Action Taken':         'approved',
    'Inspection Scheduled': 'inspection_scheduled',
    'Under Review':         'inspection_scheduled',
    'Submitted':            'submitted'
  };

  var detailGrvLoaded = false;

  function setupTabs() {
    document.querySelectorAll('.officer-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        document.querySelectorAll('.officer-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.officer-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('tab' + capitalize(target));
        if (panel) panel.classList.add('active');
        if (target === 'grievances' && !detailGrvLoaded && appData) {
          detailGrvLoaded = true;
          loadGrievancesForApp(appData.appId || appId);
        }
      });
    });
  }

  function loadGrievancesForApp(restaurantId) {
    var listEl  = document.getElementById('detailGrvList');
    var countEl = document.getElementById('detailGrvCount');
    if (!listEl) return;

    firebase.firestore()
      .collection('grievances')
      .where('restaurantId', '==', restaurantId)
      .get()
      .then(function (snap) {
        if (snap.empty) {
          listEl.innerHTML = '<div class="officer-info-loading">No grievances filed against this FBO.</div>';
          return;
        }

        var docs = snap.docs
          .map(function (d) { return Object.assign({ _id: d.id }, d.data()); })
          .sort(function (a, b) {
            var ta = a.filedAt && a.filedAt.seconds ? a.filedAt.seconds : 0;
            var tb = b.filedAt && b.filedAt.seconds ? b.filedAt.seconds : 0;
            return tb - ta;
          });

        if (countEl) countEl.textContent = docs.length;

        var rows = docs.map(function (g) {
          var filed = g.filedAt && g.filedAt.toDate
            ? g.filedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';
          var sk = DETAIL_STATUS_KEYS[g.status] || 'submitted';
          var hasFboResponse = g.fboResponse && g.fboResponse.comment;
          return '<tr>' +
            '<td>' + filed + '</td>' +
            '<td>' + esc(DETAIL_CATEGORY_LABELS[g.category] || g.category || '—') + '</td>' +
            '<td style="font-weight:600">' + (g.overall || '—') + ' / 5</td>' +
            '<td>' + esc(g.consumerName  || '—') + '</td>' +
            '<td>' + esc(g.consumerPhone || '—') + '</td>' +
            '<td class="officer-grv-comment">' + esc(g.comment || '') + '</td>' +
            '<td>' + (hasFboResponse ? '<span style="color:#16a34a;font-weight:600;font-size:12px">✔ Responded</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>') + '</td>' +
            '<td><span class="officer-badge officer-badge--' + sk + '">' + esc(g.status || '—') + '</span></td>' +
          '</tr>';
        }).join('');

        listEl.innerHTML =
          '<table class="officer-table" style="margin-top:0">' +
            '<thead><tr>' +
              '<th>Filed</th><th>Category</th><th>Overall</th>' +
              '<th>Consumer</th><th>Phone</th><th>Comment</th>' +
              '<th>FBO Response</th><th>Status</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>';
      })
      .catch(function (err) {
        listEl.innerHTML = '<div class="officer-info-loading">Failed to load grievances.</div>';
        console.error('[officer-detail] grievances:', err);
      });
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── Load application ──────────────────────────────────────────
  function loadApplication() {
    firebase.firestore().collection('applications').doc(appId).get().then(function (doc) {
      if (!doc.exists) {
        setText('detailBizName', 'Application not found');
        return;
      }

      appData = doc.data();

      var renderAll = function () {
        var status  = appData.applicationStatus || 'submitted';
        var bizName = (appData.details && appData.details.bizName) || appData.appId || appId;

        setText('detailBizName', bizName);
        setText('detailAppId',   appData.appId || appId);

        renderPipeline(status);
        renderStatusBadge(status);
        renderMeta(appData);
        renderBusinessInfo(appData);
        renderDocuments(appData);
        renderInspection(appData);
        renderAudit(appData);
        renderFlags(appData);
        setupHeaderActions(status);
      };

      if (!appData.phone && appData.uid) {
        firebase.firestore().collection('users').doc(appData.uid).get()
          .then(function (userDoc) {
            if (userDoc.exists && userDoc.data().phone) {
              appData.phone = userDoc.data().phone;
            }
            renderAll();
          })
          .catch(renderAll);
      } else {
        renderAll();
      }

    }).catch(function (err) {
      console.error('[FOSCOS] detail load:', err);
    });
  }

  // ── Utilities ─────────────────────────────────────────────────
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val || '');
  }

  // ── Init ──────────────────────────────────────────────────────
  document.addEventListener('officer-ready', function () {
    setupTabs();

    // Generic modal events
    document.getElementById('actionModalCancel').addEventListener('click', closeActionModal);
    document.getElementById('actionModalConfirm').addEventListener('click', executeAction);
    document.getElementById('actionModalOverlay').addEventListener('click', function (e) {
      if (e.target === document.getElementById('actionModalOverlay')) closeActionModal();
    });

    // Flag modal events
    document.getElementById('flagModalCancel').addEventListener('click', closeFlagModal);
    document.getElementById('flagModalConfirm').addEventListener('click', executeFlag);
    document.getElementById('flagModalOverlay').addEventListener('click', function (e) {
      if (e.target === document.getElementById('flagModalOverlay')) closeFlagModal();
    });

    if (!appId) {
      setText('detailBizName', 'Invalid application ID');
      return;
    }

    loadApplication();
  });

})();
