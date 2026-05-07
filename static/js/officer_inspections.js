(function () {
  'use strict';

  var INSP_STATUSES = ['inspection_scheduled', 'inspection_complete', 'final_review', 'approved'];

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

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val === null || val === undefined ? '—' : val);
  }

  /* ── Tab switching ───────────────────────────────────────────── */
  function setupTabs() {
    document.querySelectorAll('.officer-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        document.querySelectorAll('.officer-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.officer-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('tab' + target.charAt(0).toUpperCase() + target.slice(1));
        if (panel) panel.classList.add('active');
      });
    });
  }

  /* ── Regulatory table ────────────────────────────────────────── */
  function renderRegulatory(apps) {
    document.getElementById('regLoading').style.display = 'none';
    setText('inspCountReg', apps.length);

    if (!apps.length) {
      document.getElementById('regEmpty').style.display = '';
      return;
    }

    var complete = apps.filter(function (a) {
      return a.applicationStatus === 'inspection_complete' ||
             a.applicationStatus === 'final_review' ||
             a.applicationStatus === 'approved';
    }).length;
    var pending = apps.length - complete;

    var existingComplete = parseInt(document.getElementById('inspCountComplete').textContent) || 0;
    var existingPending  = parseInt(document.getElementById('inspCountPending').textContent) || 0;
    setText('inspCountComplete', existingComplete + complete);
    setText('inspCountPending',  existingPending  + pending);

    var rows = apps.map(function (a) {
      var bizName  = (a.details && a.details.bizName) || a.appId || '—';
      var rec      = a.inspectionRecord || {};
      var appId    = a.appId || '';
      var inspDate = rec.date    || '—';
      var officer  = rec.officer || '—';
      var appSt    = a.applicationStatus || '';
      var inspSt   = rec.date
        ? (appSt === 'inspection_scheduled' ? 'Scheduled' : 'Recorded')
        : 'Not Set';
      var inspStColor = rec.date ? '#16a34a' : '#b45309';

      return '<tr>' +
        '<td style="font-weight:600;">' + esc(bizName) + '</td>' +
        '<td style="font-family:monospace;font-size:12px;">' + esc(appId) + '</td>' +
        '<td>' + esc(inspDate) + '</td>' +
        '<td>' + esc(officer) + '</td>' +
        '<td><span class="officer-badge officer-badge--' + esc(appSt) + '">' +
          esc(APP_STATUS_LABELS[appSt] || appSt) +
        '</span></td>' +
        '<td><span style="font-size:12px;font-weight:600;color:' + inspStColor + ';">' + esc(inspSt) + '</span></td>' +
        '<td><a class="officer-table-link" href="/officer/inspections/regulatory/' + esc(appId) + '">View →</a></td>' +
      '</tr>';
    });

    document.getElementById('regTableBody').innerHTML = rows.join('');
    document.getElementById('regTableWrap').style.display = '';
  }

  /* ── Surveillance table ──────────────────────────────────────── */
  function renderSurveillance(grvs, appById) {
    document.getElementById('survLoading').style.display = 'none';
    setText('inspCountSurv', grvs.length);

    if (!grvs.length) {
      document.getElementById('survEmpty').style.display = '';
      return;
    }

    var resolved = grvs.filter(function (g) { return g.status === 'Resolved'; }).length;
    var existingComplete = parseInt(document.getElementById('inspCountComplete').textContent) || 0;
    var existingPending  = parseInt(document.getElementById('inspCountPending').textContent) || 0;
    setText('inspCountComplete', existingComplete + resolved);
    setText('inspCountPending',  existingPending  + (grvs.length - resolved));

    var rows = grvs.map(function (g) {
      var app      = appById[g.restaurantId] || {};
      var bizName  = (app.details && app.details.bizName) || g.restaurantId || '—';
      var badge    = GRV_STATUS_TO_BADGE[g.status] || 'submitted';

      return '<tr>' +
        '<td style="font-weight:600;">' + esc(bizName) + '</td>' +
        '<td>' + esc(g.category || '—') + '</td>' +
        '<td>' + esc(g.inspectionDate) + '</td>' +
        '<td><span class="officer-badge officer-badge--' + esc(badge) + '">' + esc(g.status || '—') + '</span></td>' +
        '<td><a class="officer-table-link" href="/officer/inspections/surveillance/' + esc(g._id) + '">View →</a></td>' +
      '</tr>';
    });

    document.getElementById('survTableBody').innerHTML = rows.join('');
    document.getElementById('survTableWrap').style.display = '';
  }

  /* ── Boot ────────────────────────────────────────────────────── */
  document.addEventListener('officer-ready', function () {
    var d = new Date();
    var dateEl = document.getElementById('inspPageDate');
    if (dateEl) {
      dateEl.textContent = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    setupTabs();

    setText('inspCountComplete', 0);
    setText('inspCountPending',  0);

    Promise.all([
      firebase.firestore().collection('applications').get(),
      firebase.firestore().collection('grievances').get()
    ]).then(function (results) {
      var appDocs = results[0].docs.map(function (d) { return d.data(); });
      var grvDocs = results[1].docs.map(function (d) { return Object.assign({ _id: d.id }, d.data()); });

      /* Build lookup: appId → application data (for FBO name resolution in surveillance) */
      var appById = {};
      appDocs.forEach(function (a) { if (a.appId) appById[a.appId] = a; });

      var regulatory   = appDocs.filter(function (a) {
        return INSP_STATUSES.indexOf(a.applicationStatus) !== -1;
      });
      var surveillance = grvDocs.filter(function (g) { return !!g.inspectionDate; });

      renderRegulatory(regulatory);
      renderSurveillance(surveillance, appById);
    }).catch(function (err) {
      console.error('[officer-inspections]', err);
      document.getElementById('regLoading').textContent  = 'Failed to load data.';
      document.getElementById('survLoading').textContent = 'Failed to load data.';
    });
  });

})();
