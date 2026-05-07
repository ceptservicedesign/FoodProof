/* ============================================================
   OFFICER_DASHBOARD.JS — Dashboard stats, charts, recent table
   ============================================================ */
(function () {
  'use strict';

  var STATUS_LABELS = {
    submitted:            'Submitted',
    documents_requested:  'Docs Requested',
    inspection_scheduled: 'Inspection Scheduled',
    inspection_complete:  'Inspection Complete',
    final_review:         'Final Review',
    approved:             'Approved',
    rejected:             'Rejected'
  };

  var STATUS_COLORS = {
    submitted:            '#3b82f6',
    documents_requested:  '#f59e0b',
    inspection_scheduled: '#8b5cf6',
    inspection_complete:  '#06b6d4',
    final_review:         '#f97316',
    approved:             '#22c55e',
    rejected:             '#ef4444'
  };

  var TIER_LABELS = {
    'temporary-basic': 'Basic Reg.',
    'basic':           'State (Basic)',
    'state':           'State',
    'central':         'Central'
  };

  // ── Greeting ─────────────────────────────────────────────────
  function setGreeting(officerName) {
    var hour = new Date().getHours();
    var salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    var name = officerName ? ', ' + officerName.split(' ')[0] : '';
    var el = document.getElementById('dashGreeting');
    if (el) el.textContent = salutation + name;
  }

  function setDate() {
    var el = document.getElementById('dashDate');
    if (!el) return;
    var d = new Date();
    el.textContent = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ── Stats ─────────────────────────────────────────────────────
  function renderStats(apps) {
    var counts = { total: apps.length, pending: 0, approved: 0, rejected: 0 };
    apps.forEach(function (a) {
      if (a.applicationStatus === 'approved') counts.approved++;
      else if (a.applicationStatus === 'rejected') counts.rejected++;
      else counts.pending++;
    });
    setText('statTotal',    counts.total);
    setText('statPending',  counts.pending);
    setText('statApproved', counts.approved);
    setText('statRejected', counts.rejected);
  }

  // ── Pie chart ─────────────────────────────────────────────────
  function renderPieChart(apps) {
    var buckets = {};
    apps.forEach(function (a) {
      var s = a.applicationStatus || 'submitted';
      buckets[s] = (buckets[s] || 0) + 1;
    });

    var keys   = Object.keys(buckets);
    var data   = keys.map(function (k) { return buckets[k]; });
    var colors = keys.map(function (k) { return STATUS_COLORS[k] || '#94a3b8'; });
    var labels = keys.map(function (k) { return STATUS_LABELS[k] || k; });

    var ctx = document.getElementById('statusPieChart');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ': ' + c.parsed; } } } },
        cutout: '62%'
      }
    });

    // Legend
    var legend = document.getElementById('statusLegend');
    if (legend) {
      legend.innerHTML = keys.map(function (k, i) {
        return '<div class="officer-chart-legend__item">' +
          '<div class="officer-chart-legend__dot" style="background:' + colors[i] + '"></div>' +
          '<span>' + labels[i] + ' (' + data[i] + ')</span>' +
          '</div>';
      }).join('');
    }
  }

  // ── Bar chart (last 6 months) ──────────────────────────────────
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

    var ctx = document.getElementById('timelineBarChart');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(function (m) { return m.label; }),
        datasets: [{
          label: 'Applications',
          data: counts,
          backgroundColor: 'rgba(200,129,58,0.7)',
          borderRadius: 6,
          borderSkipped: false
        }]
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
  }

  // ── Recent table ──────────────────────────────────────────────
  function renderRecentTable(apps) {
    var tbody = document.getElementById('recentTableBody');
    if (!tbody) return;

    var recent = apps.slice().sort(function (a, b) {
      var ta = a.submittedAt && a.submittedAt.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt || 0);
      var tb = b.submittedAt && b.submittedAt.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt || 0);
      return tb - ta;
    }).slice(0, 8);

    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="officer-table__empty">No applications yet.</td></tr>';
      return;
    }

    tbody.innerHTML = recent.map(function (a) {
      return '<tr>' +
        '<td><code style="font-size:12px">' + esc(a.appId) + '</code></td>' +
        '<td>' + esc(a.displayName || a.phone || '—') + '</td>' +
        '<td>' + formatList(a.businessTypes) + '</td>' +
        '<td><span class="officer-tier-badge">' + (TIER_LABELS[a.tier] || a.tier || '—') + '</span></td>' +
        '<td>' + statusBadge(a.applicationStatus) + '</td>' +
        '<td>' + formatDate(a.submittedAt) + '</td>' +
        '<td><a class="officer-table-link" href="/officer/applications/' + esc(a.appId) + '">View &rarr;</a></td>' +
        '</tr>';
    }).join('');
  }

  // ── Helpers ───────────────────────────────────────────────────
  function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatList(arr) {
    if (!arr || !arr.length) return '—';
    var first = arr[0].replace(/-/g, ' ');
    return arr.length > 1 ? first + ' +' + (arr.length - 1) : first;
  }

  function statusBadge(status) {
    var label = STATUS_LABELS[status] || status || 'Unknown';
    return '<span class="officer-badge officer-badge--' + (status || '') + '">' + esc(label) + '</span>';
  }

  // ── Main ──────────────────────────────────────────────────────
  document.addEventListener('officer-ready', function (e) {
    var officerName = e.detail && e.detail.officer && e.detail.officer.displayName;
    setGreeting(officerName);
    setDate();

    firebase.firestore().collection('applications').get().then(function (snap) {
      var apps = snap.docs.map(function (d) { return d.data(); });
      var inProgress = apps.filter(function (a) { return a.applicationStatus !== 'approved'; });
      renderStats(apps);
      renderPieChart(inProgress);
      renderBarChart(apps);
      renderRecentTable(inProgress);
    }).catch(function (err) {
      console.error('[FOSCOS] dashboard load:', err);
    });
  });

})();
