(function () {
  'use strict';

  var grvId         = window.__GRV_ID__;
  var grvData       = null;
  var pendingAction = null;
  var currentOfficer = 'FSO';

  var CATEGORY_LABELS = {
    'hygiene':       'Hygiene',
    'food-quality':  'Food Quality',
    'mislabelling':  'Mislabelling',
    'adulteration':  'Adulteration'
  };

  /* Firestore status strings → pipeline data-step slugs */
  var STATUS_TO_STEP = {
    'Submitted':            'submitted',
    'Under Review':         'under_review',
    'Action Taken':         'action_taken',
    'Inspection Scheduled': 'inspection_scheduled',
    'Resolved':             'resolved'
  };

  var PIPELINE_ORDER = [
    'submitted', 'under_review', 'action_taken', 'inspection_scheduled', 'resolved'
  ];

  /* Firestore status → existing badge CSS modifier */
  var STATUS_TO_BADGE = {
    'Submitted':            'submitted',
    'Under Review':         'inspection_scheduled',
    'Action Taken':         'approved',
    'Inspection Scheduled': 'inspection_scheduled',
    'Resolved':             'resolved'
  };

  /* ── Utilities ─────────────────────────────────────────────── */

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val || '—');
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

  /* ── Pipeline ──────────────────────────────────────────────── */

  function renderPipeline(status) {
    var stepSlug   = STATUS_TO_STEP[status] || 'submitted';
    var currentIdx = PIPELINE_ORDER.indexOf(stepSlug);
    var steps      = document.querySelectorAll('#detailPipeline .officer-pipeline__step');
    steps.forEach(function (step) {
      var s   = step.getAttribute('data-step');
      var idx = PIPELINE_ORDER.indexOf(s);
      step.classList.remove('active', 'done');
      if (s === stepSlug) {
        step.classList.add('active');
      } else if (idx < currentIdx) {
        step.classList.add('done');
      }
    });
  }

  /* ── Status badge ──────────────────────────────────────────── */

  function renderStatusBadge(status) {
    var el = document.getElementById('currentStatusBadge');
    if (!el) return;
    el.textContent = status || '—';
    el.className   = 'officer-status-badge-lg officer-badge officer-badge--' + (STATUS_TO_BADGE[status] || 'submitted');
  }

  /* ── Meta sidebar ──────────────────────────────────────────── */

  function renderMeta(g) {
    setText('metaFiled',          formatDate(g.filedAt));
    setText('metaCategory',       CATEGORY_LABELS[g.category] || g.category || '—');
    setText('metaRestaurant',     g.restaurantName || '—');
    setText('metaOverall',        g.overall !== undefined ? g.overall + ' / 5' : '—');
    setText('metaInspectionDate', g.inspectionDate || 'Not scheduled');
  }

  /* ── Tab: Grievance Details ────────────────────────────────── */

  function renderDetails(g) {
    var grid = document.getElementById('detailsGrid');
    if (!grid) return;
    grid.innerHTML = [
      infoItem('Grievance ID',    g.id || grvId),
      infoItem('Restaurant',      g.restaurantName || '—'),
      infoItem('Restaurant ID',   g.restaurantId   || '—'),
      infoItem('Category',        CATEGORY_LABELS[g.category] || g.category || '—'),
      infoItem('Overall Rating',  g.overall !== undefined ? g.overall + ' / 5' : '—'),
      infoItem('Filed On',        formatDate(g.filedAt)),
      infoItem('Current Status',  g.status || '—'),
      infoItem('Inspection Date', g.inspectionDate || 'Not scheduled'),
      infoItemFull('Comment', g.comment || '(no comment)')
    ].join('');
  }

  /* ── Tab: Evidence & Ratings ───────────────────────────────── */

  function renderRatings(g) {
    var wrap = document.getElementById('ratingsGrid');
    if (!wrap) return;
    var r = g.ratings || {};

    var stars = function (v) {
      var s = '';
      for (var i = 1; i <= 5; i++) s += (i <= v ? '★' : '☆');
      return s;
    };

    var evidence = g.consumerEvidence || [];
    var evidenceHtml;
    if (evidence.length) {
      evidenceHtml = evidence.map(function (ev) {
        return '<div style="display:flex;align-items:center;gap:8px;background:var(--white);border:1.5px solid #e0ddd5;border-radius:8px;padding:8px 10px;margin-bottom:6px;">' +
          '<span>📄</span>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:600;color:var(--navy);">' + esc(ev.fileName || 'File') + '</div>' +
            (ev.uploadedAt ? '<div style="font-size:11px;color:var(--text-muted);">' + formatDate(ev.uploadedAt) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    } else {
      evidenceHtml = '<span style="font-size:13px;font-style:italic;color:var(--text-muted)">No evidence uploaded by consumer.</span>';
    }

    wrap.innerHTML =
      '<div class="officer-info-grid" style="margin-bottom:16px">' +
        infoItem('Premise Cleanliness', (r.cleanliness || '—') + ' / 5  ' + stars(r.cleanliness)) +
        infoItem('Food Freshness',      (r.freshness   || '—') + ' / 5  ' + stars(r.freshness)) +
        infoItem('Staff Hygiene',       (r.hygiene     || '—') + ' / 5  ' + stars(r.hygiene)) +
        infoItem('Overall Score',       (g.overall     || '—') + ' / 5') +
      '</div>' +
      '<div class="officer-info-item officer-info-item--full">' +
        '<span class="officer-info-item__label">Consumer Evidence</span>' +
        '<div class="officer-info-item__value">' + evidenceHtml + '</div>' +
      '</div>';
  }

  /* ── Tab: Consumer Details ─────────────────────────────────── */

  function renderConsumer(g) {
    var grid = document.getElementById('consumerGrid');
    if (!grid) return;
    grid.innerHTML = [
      infoItem('Full Name',     g.consumerName  || '—'),
      infoItem('Phone Number',  g.consumerPhone || '—'),
      infoItemFull('Note', 'Consumer identity is visible to FSO only. FBOs see ratings and comments only.')
    ].join('');
  }

  /* ── Tab: FBO Response ─────────────────────────────────────── */

  function renderFboResponse(g) {
    var wrap = document.getElementById('fboResponsePanel');
    if (!wrap) return;
    var fr = g.fboResponse;
    var html = '';

    /* Response text */
    if (fr && fr.comment) {
      var when = fr.submittedAt && fr.submittedAt.toDate ? formatDate(fr.submittedAt) : '—';
      html +=
        '<div class="officer-audit-item" style="align-items:flex-start">' +
          '<div class="officer-audit-item__dot" style="background:var(--amber);margin-top:4px"></div>' +
          '<div>' +
            '<div class="officer-audit-item__action">' + esc(fr.comment) + '</div>' +
            '<div class="officer-audit-item__meta">Submitted by ' + esc(fr.submittedBy || 'FBO') + ' &bull; ' + when + '</div>' +
          '</div>' +
        '</div>';
    } else {
      html += '<p class="officer-info-loading" style="margin-bottom:16px">No response submitted by the FBO yet.</p>';
    }

    /* Classification */
    var cls = g.fboClassification;
    if (cls) {
      var clsLabel = cls === 'genuine' ? '✔ Genuine Complaint' : '⚠ Marked Fake / Invalid';
      var clsColor = cls === 'genuine' ? '#15803d' : '#b91c1c';
      html += '<div style="margin-top:16px;padding:10px 14px;border-radius:8px;background:#f8f8f8;border:1px solid #e0e0e0;">' +
        '<span style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:4px;">FBO Classification</span>' +
        '<span style="font-size:13.5px;font-weight:700;color:' + clsColor + ';">' + clsLabel + '</span>' +
      '</div>';
    }

    /* Evidence files */
    var evidence = g.fboEvidence || [];
    html += '<div style="margin-top:16px;">';
    html += '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;">FBO Evidence (' + evidence.length + ' file' + (evidence.length === 1 ? '' : 's') + ')</div>';
    if (evidence.length) {
      evidence.forEach(function (ev) {
        html += '<div style="display:flex;align-items:flex-start;gap:10px;background:var(--white);border:1.5px solid #e0ddd5;border-radius:8px;padding:10px 12px;margin-bottom:6px;">' +
          '<span style="font-size:18px;">📄</span>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:600;color:var(--navy);">' + esc(ev.fileName || 'File') + '</div>' +
            (ev.note ? '<div style="font-size:12px;color:var(--text-muted);">' + esc(ev.note) + '</div>' : '') +
            '<div style="font-size:11px;color:var(--text-muted);">' + formatDate(ev.uploadedAt) + '</div>' +
          '</div>' +
        '</div>';
      });
    } else {
      html += '<p style="font-size:13px;color:var(--text-muted);">No evidence files uploaded.</p>';
    }
    html += '</div>';

    wrap.innerHTML = html;
  }

  /* ── Tab: Status History ───────────────────────────────────── */

  function renderHistory(g) {
    var wrap = document.getElementById('historyPanel');
    if (!wrap) return;
    var hist = g.statusHistory;
    if (!hist || !hist.length) {
      wrap.innerHTML = '<p class="officer-info-loading">No status history yet.</p>';
      return;
    }
    var sorted = hist.slice().sort(function (a, b) {
      var ta = a.changedAt && a.changedAt.seconds ? a.changedAt.seconds : 0;
      var tb = b.changedAt && b.changedAt.seconds ? b.changedAt.seconds : 0;
      return tb - ta;
    });
    wrap.innerHTML = '<div class="officer-audit-list">' +
      sorted.map(function (h) {
        var when = h.changedAt && h.changedAt.toDate ? formatDateTime(h.changedAt) : '—';
        var badge = STATUS_TO_BADGE[h.status] || 'submitted';
        return '<div class="officer-audit-item">' +
          '<div class="officer-audit-item__dot"></div>' +
          '<div>' +
            '<div class="officer-audit-item__action">' +
              '<span class="officer-badge officer-badge--' + badge + '" style="font-size:11px">' + esc(h.status) + '</span>' +
            '</div>' +
            '<div class="officer-audit-item__meta">By ' + esc(h.changedBy || 'FSO') + ' &bull; ' + when + '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  /* ── Header action buttons ─────────────────────────────────── */

  function setupHeaderActions(status) {
    var isResolved = (status === 'Resolved');

    var advanceBtn    = document.getElementById('btnAdvanceStep');
    var inspectBtn    = document.getElementById('btnScheduleInspection');
    var resolveBtn    = document.getElementById('btnResolve');
    var flagBtn       = document.getElementById('btnFlag');
    var contactBtn    = document.getElementById('btnContactConsumer');

    /* Reset visibility so re-renders after status changes restore hidden buttons */
    if (advanceBtn) advanceBtn.style.display = '';
    if (inspectBtn) inspectBtn.style.display = '';
    if (resolveBtn) resolveBtn.style.display = '';

    /* Advance Step — available unless already at Resolved or Inspection Scheduled */
    if (advanceBtn) {
      if (isResolved || status === 'Inspection Scheduled') {
        advanceBtn.style.display = 'none';
      } else {
        var nextStatus = nextInPipeline(status);
        if (nextStatus) {
          advanceBtn.onclick = function () { openActionModal('advance', nextStatus); };
        } else {
          advanceBtn.style.display = 'none';
        }
      }
    }

    /* Schedule Inspection — available at Submitted, Under Review or Action Taken */
    if (inspectBtn) {
      if (status === 'Submitted' || status === 'Under Review' || status === 'Action Taken') {
        inspectBtn.onclick = function () { openActionModal('inspect', 'Inspection Scheduled'); };
      } else {
        inspectBtn.style.display = 'none';
      }
    }

    /* Resolve Case — available at Action Taken or Inspection Scheduled */
    if (resolveBtn) {
      if (status === 'Action Taken' || status === 'Inspection Scheduled') {
        resolveBtn.onclick = function () { openActionModal('resolve', 'Resolved'); };
      } else {
        resolveBtn.style.display = 'none';
      }
    }

    /* Flag — always available */
    if (flagBtn) flagBtn.onclick = openFlagModal;

    /* Contact Consumer — opens read-only modal, no Firestore write */
    if (contactBtn) {
      contactBtn.onclick = function () {
        setText('contactName',  grvData.consumerName  || '—');
        setText('contactPhone', grvData.consumerPhone || '—');
        document.getElementById('contactModalOverlay').classList.add('open');
      };
    }
  }

  function nextInPipeline(status) {
    var ORDER = ['Submitted', 'Under Review', 'Action Taken', 'Inspection Scheduled', 'Resolved'];
    var idx = ORDER.indexOf(status);
    return (idx >= 0 && idx < ORDER.length - 1) ? ORDER[idx + 1] : null;
  }

  /* ── Action modal ──────────────────────────────────────────── */

  function openActionModal(action, targetStatus) {
    var LABELS = {
      advance: 'Advance Grievance',
      inspect: 'Schedule Inspection',
      resolve: 'Resolve Case'
    };
    var BODIES = {
      advance: 'Move this grievance to the next stage.',
      inspect: 'Set an inspection date and move the status to Inspection Scheduled.',
      resolve: 'Mark this grievance as Resolved. The consumer and FBO will be notified.'
    };

    document.getElementById('actionModalTitle').textContent = LABELS[action] || 'Confirm';
    document.getElementById('actionModalBody').textContent  = BODIES[action] || '';
    document.getElementById('actionModalNote').value        = '';
    document.getElementById('actionModalError').textContent = '';

    var dateWrap = document.getElementById('actionModalDateWrap');
    dateWrap.style.display = (action === 'inspect') ? '' : 'none';
    if (action === 'inspect') document.getElementById('actionModalDate').value = '';

    document.getElementById('actionModalOverlay').classList.add('open');
    pendingAction = { action: action, targetStatus: targetStatus };
  }

  function closeActionModal() {
    document.getElementById('actionModalOverlay').classList.remove('open');
    pendingAction = null;
  }

  function executeAction() {
    if (!pendingAction || !grvData) return;

    var note         = document.getElementById('actionModalNote').value.trim();
    var confirmBtn   = document.getElementById('actionModalConfirm');
    var errEl        = document.getElementById('actionModalError');
    var action       = pendingAction.action;
    var targetStatus = pendingAction.targetStatus;

    var dateStr = '';
    if (action === 'inspect') {
      dateStr = document.getElementById('actionModalDate').value;
      if (!dateStr) { errEl.textContent = 'Please select an inspection date.'; return; }
    }

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Saving…';
    errEl.textContent      = '';

    var histEntry = {
      status:    targetStatus,
      changedAt: firebase.firestore.Timestamp.fromDate(new Date()),
      changedBy: currentOfficer
    };

    var update = {
      status:        targetStatus,
      statusHistory: firebase.firestore.FieldValue.arrayUnion(histEntry)
    };
    if (dateStr) update.inspectionDate = dateStr;
    if (note)    update.inspectionNote = note;

    firebase.firestore().collection('grievances').doc(grvId).update(update)
      .then(function () {
        closeActionModal();
        loadGrievance();
      })
      .catch(function (err) {
        console.error('[officer-grievance-detail] action:', err);
        errEl.textContent      = 'Failed to save. Please try again.';
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Confirm';
      });
  }

  /* ── Flag modal ────────────────────────────────────────────── */

  function openFlagModal() {
    document.getElementById('flagIssueType').value      = '';
    document.getElementById('flagPriority').value       = 'medium';
    document.getElementById('flagNote').value           = '';
    document.getElementById('flagModalError').textContent = '';
    document.getElementById('flagModalOverlay').classList.add('open');
  }

  function closeFlagModal() {
    document.getElementById('flagModalOverlay').classList.remove('open');
  }

  function executeFlag() {
    var issueType  = document.getElementById('flagIssueType').value;
    var priority   = document.getElementById('flagPriority').value;
    var note       = document.getElementById('flagNote').value.trim();
    var errEl      = document.getElementById('flagModalError');
    var confirmBtn = document.getElementById('flagModalConfirm');

    if (!issueType) { errEl.textContent = 'Please select an issue type.'; return; }

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Saving…';
    errEl.textContent      = '';

    var flagEntry = {
      issueType: issueType,
      priority:  priority,
      note:      note || '',
      by:        currentOfficer,
      flaggedAt: new Date().toISOString()
    };

    firebase.firestore().collection('grievances').doc(grvId).update({
      flags: firebase.firestore.FieldValue.arrayUnion(flagEntry)
    })
      .then(function () {
        closeFlagModal();
        loadGrievance();
      })
      .catch(function (err) {
        console.error('[officer-grievance-detail] flag:', err);
        errEl.textContent      = 'Failed to save. Please try again.';
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Flag Grievance';
      });
  }

  /* ── Tabs ──────────────────────────────────────────────────── */

  function setupTabs() {
    document.querySelectorAll('.officer-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        document.querySelectorAll('.officer-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.officer-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('tab' + capitalize(target));
        if (panel) panel.classList.add('active');
      });
    });
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ── Load grievance ────────────────────────────────────────── */

  function loadGrievance() {
    firebase.firestore().collection('grievances').doc(grvId).get()
      .then(function (doc) {
        if (!doc.exists) {
          setText('detailRestaurantName', 'Grievance not found');
          return;
        }

        grvData = Object.assign({ _id: doc.id }, doc.data());

        setText('detailRestaurantName', grvData.restaurantName || '—');
        setText('detailGrvId',          grvData.id || grvId);

        renderPipeline(grvData.status);
        renderStatusBadge(grvData.status);
        renderMeta(grvData);
        renderDetails(grvData);
        renderRatings(grvData);
        renderConsumer(grvData);
        renderFboResponse(grvData);
        renderHistory(grvData);
        setupHeaderActions(grvData.status);
      })
      .catch(function (err) {
        console.error('[officer-grievance-detail] load:', err);
        setText('detailRestaurantName', 'Failed to load');
      });
  }

  /* ── Init ──────────────────────────────────────────────────── */

  document.addEventListener('officer-ready', function (e) {
    if (e.detail && e.detail.officer && e.detail.officer.displayName) {
      currentOfficer = e.detail.officer.displayName;
    }

    setupTabs();

    document.getElementById('actionModalCancel').addEventListener('click', closeActionModal);
    document.getElementById('actionModalConfirm').addEventListener('click', executeAction);
    document.getElementById('actionModalOverlay').addEventListener('click', function (e) {
      if (e.target === document.getElementById('actionModalOverlay')) closeActionModal();
    });

    document.getElementById('flagModalCancel').addEventListener('click', closeFlagModal);
    document.getElementById('flagModalConfirm').addEventListener('click', executeFlag);
    document.getElementById('flagModalOverlay').addEventListener('click', function (e) {
      if (e.target === document.getElementById('flagModalOverlay')) closeFlagModal();
    });

    document.getElementById('contactModalClose').addEventListener('click', function () {
      document.getElementById('contactModalOverlay').classList.remove('open');
    });
    document.getElementById('contactModalOverlay').addEventListener('click', function (e) {
      if (e.target === document.getElementById('contactModalOverlay')) {
        document.getElementById('contactModalOverlay').classList.remove('open');
      }
    });

    if (!grvId) {
      setText('detailRestaurantName', 'Invalid grievance ID');
      return;
    }

    loadGrievance();
  });

})();
