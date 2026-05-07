(function () {
  'use strict';

  var inspType = window.__INSP_TYPE__;
  var inspId   = window.__INSP_ID__;

  var TIER_LABELS = {
    'temporary-basic': 'Basic Registration',
    'basic':           'State License (Basic)',
    'state':           'State License',
    'central':         'Central License'
  };

  var APP_STATUS_LABELS = {
    inspection_scheduled: 'Inspection Scheduled',
    inspection_complete:  'Inspection Complete',
    final_review:         'Final Review',
    approved:             'Approved'
  };

  var GRV_STATUS_TO_BADGE = {
    'Submitted':            'submitted',
    'Under Review':         'inspection_scheduled',
    'Action Taken':         'approved',
    'Inspection Scheduled': 'inspection_scheduled',
    'Resolved':             'resolved'
  };

  var CATEGORY_LABELS = {
    'hygiene':      'Hygiene',
    'food-quality': 'Food Quality',
    'mislabelling': 'Mislabelling',
    'adulteration': 'Adulteration'
  };

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val === null || val === undefined ? '—' : val);
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

  /* ── Regulatory (application-linked) ────────────────────────── */
  function loadRegulatory() {
    firebase.firestore().collection('applications').doc(inspId).get()
      .then(function (doc) {
        if (!doc.exists) {
          setText('inspDtlTitle', 'Inspection not found');
          setText('inspDtlSub', 'The application could not be located.');
          return;
        }

        var d       = doc.data();
        var rec     = d.inspectionRecord || {};
        var bizName = (d.details && d.details.bizName) || d.appId || '—';
        var status  = d.applicationStatus || '—';
        var tier    = TIER_LABELS[d.tier] || d.tier || '—';
        var district = (d.details && d.details.addrDistrict) || '—';
        var addr    = [d.details && d.details.addrLine1, district, d.details && d.details.addrState, d.details && d.details.addrPincode].filter(Boolean).join(', ');

        setText('inspDtlTitle', bizName);
        setText('inspDtlSub', 'Regulatory Inspection · ' + (d.appId || inspId));
        setText('inspDtlTypeBadge', 'Regulatory');

        /* Sidebar */
        setText('inspDtlFboName',  bizName);
        setText('inspDtlFboId',    d.appId || inspId);
        setText('inspDtlDistrict', district);
        setText('inspDtlTier',     tier);
        setText('inspDtlType',     'Regulatory — Licensing');
        setText('inspDtlDate',     rec.date || 'Not scheduled');
        setText('inspDtlStatus',   APP_STATUS_LABELS[status] || status);

        var fboLink = document.getElementById('inspDtlFboLink');
        if (fboLink) fboLink.href = '/officer/fbo-directory/' + esc(d.appId || inspId);

        var srcLink = document.getElementById('inspDtlSourceLink');
        if (srcLink) srcLink.href = '/officer/applications/' + esc(d.appId || inspId);

        /* Status badge */
        var badge = document.getElementById('inspDtlStatusBadge');
        if (badge) {
          badge.className   = 'officer-badge officer-badge--' + esc(status);
          badge.textContent = APP_STATUS_LABELS[status] || status;
        }

        /* Inspection details grid */
        var recStatus = rec.date ? 'Recorded' : 'Pending';
        document.getElementById('inspDtlGrid').innerHTML = [
          infoItem('Inspection Type',     'Regulatory — Pre-Licensing'),
          infoItem('Scheduled Date',      rec.date    || 'Not set'),
          infoItem('Assigned Officer',    rec.officer || 'Not assigned'),
          infoItem('Record Status',       recStatus),
          infoItem('Saved By',            rec.savedBy || '—')
        ].join('');

        /* Notes section */
        if (rec.notes) {
          document.getElementById('inspDtlNotesSection').style.display = '';
          setText('inspDtlNotes', rec.notes);
        }

        /* Linked application card */
        setText('inspDtlLinkTitle', 'Linked Application');
        document.getElementById('inspDtlLinkContent').innerHTML =
          '<div class="officer-info-grid">' + [
            infoItem('Application ID',  d.appId || inspId),
            infoItem('License Type',    tier),
            infoItem('Submitted',       formatDate(d.submittedAt)),
            infoItem('Current Status',  APP_STATUS_LABELS[status] || status),
            infoItem('Duration',        d.years ? d.years + ' year' + (d.years > 1 ? 's' : '') : '—'),
            infoItemFull('Business Address', addr || '—')
          ].join('') + '</div>';

        var btnWrap = document.getElementById('inspDtlLinkBtn');
        if (btnWrap) {
          btnWrap.innerHTML = '<a href="/officer/applications/' + esc(d.appId || inspId) + '" class="officer-modal__confirm" style="text-decoration:none;display:inline-block;font-size:13px;">Open Application Detail →</a>';
        }
      })
      .catch(function (err) {
        console.error('[inspection-detail] regulatory load:', err);
        setText('inspDtlTitle', 'Failed to load inspection');
      });
  }

  /* ── Surveillance (grievance-linked) ─────────────────────────── */
  function loadSurveillance() {
    firebase.firestore().collection('grievances').doc(inspId).get()
      .then(function (doc) {
        if (!doc.exists) {
          setText('inspDtlTitle', 'Inspection not found');
          setText('inspDtlSub', 'The grievance could not be located.');
          return;
        }

        var g        = doc.data();
        var category = CATEGORY_LABELS[g.category] || g.category || '—';
        var badge    = GRV_STATUS_TO_BADGE[g.status] || 'submitted';

        setText('inspDtlTitle', g.restaurantId || '—');
        setText('inspDtlSub', 'Surveillance Inspection · ' + category);
        setText('inspDtlTypeBadge', 'Surveillance');

        /* Sidebar — need application to get bizName */
        var fboId = g.restaurantId || '';
        setText('inspDtlFboId', fboId);
        setText('inspDtlType',  'Surveillance — Grievance-Triggered');
        setText('inspDtlDate',  g.inspectionDate || '—');
        setText('inspDtlStatus', g.status || '—');

        var fboLink = document.getElementById('inspDtlFboLink');
        if (fboLink) fboLink.href = '/officer/fbo-directory/' + esc(fboId);

        var srcLink = document.getElementById('inspDtlSourceLink');
        if (srcLink) srcLink.href = '/officer/grievances/' + esc(inspId);

        /* Status badge */
        var badgeEl = document.getElementById('inspDtlStatusBadge');
        if (badgeEl) {
          badgeEl.className   = 'officer-badge officer-badge--' + esc(badge);
          badgeEl.textContent = g.status || '—';
        }

        /* Look up application for FBO name + tier */
        return firebase.firestore().collection('applications')
          .where('appId', '==', fboId)
          .limit(1)
          .get()
          .then(function (snap) {
            var app      = snap.empty ? {} : snap.docs[0].data();
            var bizName  = (app.details && app.details.bizName) || fboId || '—';
            var tier     = TIER_LABELS[app.tier] || app.tier || '—';
            var district = (app.details && app.details.addrDistrict) || '—';

            setText('inspDtlTitle',    bizName);
            setText('inspDtlFboName',  bizName);
            setText('inspDtlDistrict', district);
            setText('inspDtlTier',     tier);

            /* Inspection details grid */
            document.getElementById('inspDtlGrid').innerHTML = [
              infoItem('Inspection Type',    'Surveillance — Grievance Triggered'),
              infoItem('Inspection Date',    g.inspectionDate || '—'),
              infoItem('Category',           category),
              infoItem('Overall Rating',     g.overall ? g.overall + ' / 5' : '—'),
              infoItem('Linked FBO',         bizName)
            ].join('');

            /* Notes section — use consumer comment as context */
            if (g.comment) {
              document.getElementById('inspDtlNotesSection').style.display = '';
              setText('inspDtlNotes', g.comment);
              var notesLabel = document.querySelector('#inspDtlNotesSection div');
              if (notesLabel) notesLabel.textContent = 'Consumer Comment (Grievance Context)';
            }

            /* Linked grievance card */
            setText('inspDtlLinkTitle', 'Linked Grievance');
            var filedStr  = g.filedAt ? formatDate(g.filedAt) : '—';
            var fboResp   = (g.fboResponse && g.fboResponse.comment) ? g.fboResponse.comment : 'No response submitted';
            var classBadge = g.fboClassification
              ? (g.fboClassification === 'genuine' ? '⚠ Genuine' : '✓ Disputed') : '—';

            document.getElementById('inspDtlLinkContent').innerHTML =
              '<div class="officer-info-grid">' + [
                infoItem('Grievance ID',       inspId),
                infoItem('Filed',              filedStr),
                infoItem('Overall Rating',     g.overall ? g.overall + ' / 5' : '—'),
                infoItem('Status',             g.status || '—'),
                infoItem('FBO Classification', classBadge),
                infoItemFull('FBO Response',   fboResp)
              ].join('') + '</div>';

            var btnWrap = document.getElementById('inspDtlLinkBtn');
            if (btnWrap) {
              btnWrap.innerHTML = '<a href="/officer/grievances/' + esc(inspId) + '" class="officer-modal__confirm" style="text-decoration:none;display:inline-block;font-size:13px;">Open Grievance Detail →</a>';
            }
          });
      })
      .catch(function (err) {
        console.error('[inspection-detail] surveillance load:', err);
        setText('inspDtlTitle', 'Failed to load inspection');
      });
  }

  /* ── Boot ────────────────────────────────────────────────────── */
  document.addEventListener('officer-ready', function () {
    if (!inspId) {
      setText('inspDtlTitle', 'Invalid inspection ID');
      return;
    }
    if (inspType === 'regulatory') {
      loadRegulatory();
    } else {
      loadSurveillance();
    }
  });

})();
