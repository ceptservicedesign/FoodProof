(function () {
  'use strict';

  var fboId = window.__FBO_ID__;

  var TIER_LABELS = {
    'temporary-basic': 'Basic Registration',
    'basic':           'State License (Basic)',
    'state':           'State License',
    'central':         'Central License'
  };

  var CATEGORY_LABELS = {
    'hygiene':      'Hygiene',
    'food-quality': 'Food Quality',
    'mislabelling': 'Mislabelling',
    'adulteration': 'Adulteration'
  };

  var STATUS_BADGE = {
    'Resolved':             'officer-badge--resolved',
    'Action Taken':         'officer-badge--approved',
    'Inspection Scheduled': 'officer-badge--inspection_scheduled',
    'Under Review':         'officer-badge--inspection_scheduled',
    'Submitted':            'officer-badge--submitted'
  };

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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

  function infoItem(label, value) {
    return '<div class="officer-info-item">' +
      '<span class="officer-info-item__label">' + esc(label) + '</span>' +
      '<span class="officer-info-item__value">' + esc(value) + '</span>' +
    '</div>';
  }

  function setupTabs() {
    document.querySelectorAll('#profileTabs .officer-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('#profileTabs .officer-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.officer-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var target = tab.dataset.tab;
        var panel = document.getElementById('tab' + target.charAt(0).toUpperCase() + target.slice(1));
        if (panel) panel.classList.add('active');
      });
    });
  }

  function renderLicense(data) {
    var d = data.details || {};
    var addr = [d.addrLine1, d.addrLine2, d.addrDistrict, d.addrState, d.addrPincode]
      .filter(Boolean).join(', ');
    var tier = data.scale && data.scale.tier;
    var years = (data.review && data.review.years) || 1;
    var vUntil = '—';
    if (data.submittedAt) {
      var vd = data.submittedAt.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt);
      vd.setFullYear(vd.getFullYear() + years);
      vUntil = vd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    document.getElementById('licenseGrid').innerHTML = [
      infoItem('License Number',  data.appId || fboId),
      infoItem('License Type',    TIER_LABELS[tier] || tier || '—'),
      infoItem('Business Name',   d.bizName || data.displayName || '—'),
      infoItem('Owner Name',      d.ownerName || '—'),
      infoItem('Phone',           d.bizPhone || data.phone || '—'),
      infoItem('Address',         addr || '—'),
      infoItem('District',        d.addrDistrict || '—'),
      infoItem('State',           d.addrState || '—'),
      infoItem('License Duration', years + (years === 1 ? ' year' : ' years')),
      infoItem('Valid Until',     vUntil),
      infoItem('Submitted',       formatDate(data.submittedAt)),
      infoItem('Fee Paid',        data.review && data.review.totalFee ? '₹' + data.review.totalFee.toLocaleString('en-IN') : '—')
    ].join('');

    /* Sidebar */
    setText('metaLicenseNo',  data.appId || fboId);
    setText('metaTier',       TIER_LABELS[tier] || tier || '—');
    setText('metaValidUntil', vUntil);
    setText('metaDistrict',   d.addrDistrict || '—');
  }

  function renderInspections(appData, grievances) {
    /* Regulatory — from application inspectionRecord */
    var regEl = document.getElementById('profileRegulatoryInspections');
    if (regEl) {
      var rec = appData.inspectionRecord;
      if (rec) {
        regEl.innerHTML =
          '<div class="officer-info-grid">' +
            infoItem('Scheduled Date',   rec.date    || '—') +
            infoItem('Assigned Officer', rec.officer || '—') +
            infoItemFull('Notes',        rec.notes   || '—') +
          '</div>';
      } else {
        regEl.innerHTML = '<p style="font-size:13px;color:var(--text-muted);">No regulatory inspection recorded.</p>';
      }
    }

    /* Surveillance — grievances that have an inspectionDate set */
    var surEl = document.getElementById('profileSurveillanceInspections');
    if (!surEl) return;
    var surveyed = grievances.filter(function (g) { return !!g.inspectionDate; });
    if (!surveyed.length) {
      surEl.innerHTML = '<p style="font-size:13px;color:var(--text-muted);">No surveillance inspections scheduled yet.</p>';
      return;
    }
    var rows = surveyed.map(function (g) {
      return '<tr>' +
        '<td>' + esc(g.inspectionDate) + '</td>' +
        '<td>' + esc(CATEGORY_LABELS[g.category] || g.category || '—') + '</td>' +
        '<td><span class="officer-badge ' + (STATUS_BADGE[g.status] || 'officer-badge--submitted') + '" style="font-size:11px">' + esc(g.status) + '</span></td>' +
        '<td><a class="officer-table-link" href="/officer/grievances/' + esc(g._id) + '">View →</a></td>' +
      '</tr>';
    }).join('');
    surEl.innerHTML =
      '<div class="officer-table-wrap"><table class="officer-table">' +
        '<thead><tr><th>Date</th><th>Category</th><th>Status</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  function infoItemFull(label, value) {
    return '<div class="officer-info-item officer-info-item--full">' +
      '<span class="officer-info-item__label">' + esc(label) + '</span>' +
      '<span class="officer-info-item__value">' + esc(value) + '</span>' +
    '</div>';
  }

  function renderGrievances(grievances) {
    var openStatuses = ['Submitted', 'Under Review', 'Action Taken', 'Inspection Scheduled'];
    var openCount = grievances.filter(function (g) { return openStatuses.indexOf(g.status) !== -1; }).length;

    setText('metaGrvCount', openCount + ' open / ' + grievances.length + ' total');

    var countBadge = document.getElementById('profileGrvCount');
    if (countBadge) {
      if (openCount > 0) { countBadge.textContent = openCount; countBadge.style.display = ''; }
      else countBadge.style.display = 'none';
    }

    if (!grievances.length) {
      document.getElementById('profileGrvList').innerHTML =
        '<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">No grievances filed against this FBO.</p>';
      return;
    }

    var rows = grievances.map(function (g) {
      var badgeCls = STATUS_BADGE[g.status] || 'officer-badge--submitted';
      var filed = g.filedAt && g.filedAt.toDate
        ? g.filedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
      var hasFboResp = g.fboResponse && g.fboResponse.comment;
      return '<tr>' +
        '<td>' + filed + '</td>' +
        '<td>' + esc(CATEGORY_LABELS[g.category] || g.category || '—') + '</td>' +
        '<td style="font-weight:600">' + (g.overall || '—') + ' / 5</td>' +
        '<td><span class="officer-badge ' + badgeCls + '" style="font-size:11px">' + esc(g.status || '—') + '</span></td>' +
        '<td>' + (hasFboResp ? '<span style="color:#15803d;font-weight:600;font-size:12px">✔ Responded</span>' : '<span style="color:#94a3b8;font-size:12px">Pending</span>') + '</td>' +
        '<td><a class="officer-table-link" href="/officer/grievances/' + esc(g._id) + '">View →</a></td>' +
      '</tr>';
    }).join('');

    document.getElementById('profileGrvList').innerHTML =
      '<div class="officer-table-wrap"><table class="officer-table">' +
        '<thead><tr><th>Filed</th><th>Category</th><th>Rating</th><th>Status</th><th>FBO Response</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  document.addEventListener('officer-ready', function () {
    setupTabs();

    var profileData = null;

    firebase.firestore().collection('applications').doc(fboId).get()
      .then(function (doc) {
        if (!doc.exists) {
          setText('profileBizName', 'FBO not found');
          return;
        }
        profileData = doc.data();
        var bizName = (profileData.details && profileData.details.bizName) || profileData.displayName || '—';
        setText('profileBizName', bizName);
        setText('profileAppId',  profileData.appId || fboId);

        renderLicense(profileData);

        return firebase.firestore().collection('grievances')
          .where('restaurantId', '==', fboId)
          .get();
      })
      .then(function (gSnap) {
        if (!gSnap) return;
        var grievances = gSnap.docs
          .map(function (d) { return Object.assign({ _id: d.id }, d.data()); })
          .sort(function (a, b) {
            var ta = a.filedAt && a.filedAt.seconds ? a.filedAt.seconds : 0;
            var tb = b.filedAt && b.filedAt.seconds ? b.filedAt.seconds : 0;
            return tb - ta;
          });
        renderGrievances(grievances);
        renderInspections(profileData || {}, grievances);
      })
      .catch(function (err) {
        console.error('[fbo-profile]', err);
        setText('profileBizName', 'Failed to load');
      });
  });

})();
