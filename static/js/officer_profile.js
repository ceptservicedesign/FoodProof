(function () {
  'use strict';

  var currentUid  = null;
  var officerName = null;

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val || '—');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ── Populate officer card ──────────────────────────────────── */
  function populateOfficer(uid, officer) {
    var name     = officer.displayName || '—';
    var initials = name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    var avatar   = document.getElementById('profAvatar');
    if (avatar) avatar.textContent = initials;

    setText('profName',         name);
    setText('profEmail',        officer.email || '—');
    setText('profUid',          uid);
    setText('profCreatedAt',    formatDate(officer.createdAt));
    setText('profJurisdiction', officer.jurisdiction || 'Not set');

    var jInput = document.getElementById('profJurisdictionInput');
    if (jInput && officer.jurisdiction) jInput.value = officer.jurisdiction;

    document.getElementById('profSaveBtn').addEventListener('click', function () {
      var val = (document.getElementById('profJurisdictionInput').value || '').trim();
      if (!val) return;
      firebase.firestore().collection('officers').doc(uid).update({ jurisdiction: val })
        .then(function () {
          setText('profJurisdiction', val);
          var msg = document.getElementById('profSavedMsg');
          if (msg) { msg.style.display = ''; setTimeout(function () { msg.style.display = 'none'; }, 3000); }
        });
    });
  }

  /* ── Stats ──────────────────────────────────────────────────── */
  function populateStats(approved, inspections, resolved, samples, monthData) {
    setText('profStatApproved',    approved);
    setText('profStatInspections', inspections);
    setText('profStatResolved',    resolved);
    setText('profStatSamples',     samples);
    setText('profMonthApps',       monthData.apps);
    setText('profMonthGrv',        monthData.grv);
    setText('profMonthSamples',    monthData.samples);
    setText('profMonthInsp',       monthData.insp);
  }

  /* ── Monthly bar chart (last 6 months of applications) ──────── */
  function renderBarChart(apps) {
    var months = [];
    var now    = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleString('en-IN', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() });
    }
    var counts = months.map(function (m) {
      return apps.filter(function (a) {
        var ts = a.submittedAt && a.submittedAt.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt || 0);
        return ts.getFullYear() === m.year && ts.getMonth() === m.month;
      }).length;
    });

    var ctx = document.getElementById('profBarChart');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(function (m) { return m.label; }),
        datasets: [{ label: 'Applications', data: counts, backgroundColor: 'rgba(200,129,58,0.7)', borderRadius: 5, borderSkipped: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });

    /* Return this-month app count */
    return counts[5] || 0;
  }

  /* ── Boot ───────────────────────────────────────────────────── */
  document.addEventListener('officer-ready', function (e) {
    var user    = e.detail && e.detail.user;
    var officer = e.detail && e.detail.officer;
    if (!user || !officer) return;

    currentUid  = user.uid;
    officerName = officer.displayName || 'FSO';

    populateOfficer(currentUid, officer);

    var now        = new Date();
    var thisYear   = now.getFullYear();
    var thisMonth  = now.getMonth();

    var p1 = firebase.firestore().collection('applications').get();
    var p2 = firebase.firestore().collection('grievances').get();
    var p3 = firebase.firestore().collection('samples')
      .where('recordedBy', '==', officerName).get();

    Promise.all([p1, p2, p3]).then(function (results) {
      var appDocs = results[0].docs.map(function (d) { return d.data(); });
      var grvDocs = results[1].docs.map(function (d) { return d.data(); });
      var smpDocs = results[2].docs.map(function (d) { return d.data(); });

      var approved    = appDocs.filter(function (a) { return a.applicationStatus === 'approved'; }).length;
      var resolved    = grvDocs.filter(function (g) { return g.status === 'Resolved'; }).length;
      var inspections = grvDocs.filter(function (g) { return !!g.inspectionDate; }).length;

      /* This-month counts */
      function inThisMonth(ts) {
        var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        return d && d.getFullYear() === thisYear && d.getMonth() === thisMonth;
      }
      var monthApps    = appDocs.filter(function (a) { return inThisMonth(a.submittedAt); }).length;
      var monthGrv     = grvDocs.filter(function (g) { return inThisMonth(g.filedAt); }).length;
      var monthSamples = smpDocs.filter(function (s) { return inThisMonth(s.createdAt); }).length;
      var monthInsp    = grvDocs.filter(function (g) {
        if (!g.inspectionDate) return false;
        var d = new Date(g.inspectionDate);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
      }).length;

      populateStats(approved, inspections, resolved, smpDocs.length, {
        apps: monthApps, grv: monthGrv, samples: monthSamples, insp: monthInsp
      });

      renderBarChart(appDocs);
    }).catch(function (err) {
      console.error('[officer-profile]', err);
    });
  });

})();
