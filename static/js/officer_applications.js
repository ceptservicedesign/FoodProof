/* ============================================================
   OFFICER_APPLICATIONS.JS — Applications list with filter/sort
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

  var TIER_LABELS = {
    'temporary-basic': 'Basic Reg.',
    'basic':           'State (Basic)',
    'state':           'State',
    'central':         'Central'
  };

  var allApps   = [];
  var sortCol   = 'submittedAt';
  var sortDir   = -1; // -1 = desc

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function statusBadge(status) {
    var label = STATUS_LABELS[status] || status || 'Unknown';
    return '<span class="officer-badge officer-badge--' + esc(status || '') + '">' + esc(label) + '</span>';
  }

  function formatList(arr) {
    if (!arr || !arr.length) return '—';
    var first = arr[0].replace(/-/g, ' ');
    return arr.length > 1 ? first + ' +' + (arr.length - 1) : first;
  }

  function getFilteredApps() {
    var search = (document.getElementById('appSearch').value || '').toLowerCase();
    var status = document.getElementById('filterStatus').value;
    var tier   = document.getElementById('filterTier').value;

    return allApps.filter(function (a) {
      if (status && a.applicationStatus !== status) return false;
      if (tier   && a.tier !== tier)               return false;
      if (search) {
        var haystack = [a.appId, a.displayName, a.phone].join(' ').toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      return true;
    });
  }

  function sortApps(apps) {
    return apps.slice().sort(function (a, b) {
      var va = a[sortCol], vb = b[sortCol];
      if (sortCol === 'submittedAt') {
        va = va && va.toDate ? va.toDate().getTime() : new Date(va || 0).getTime();
        vb = vb && vb.toDate ? vb.toDate().getTime() : new Date(vb || 0).getTime();
      } else {
        va = String(va || '').toLowerCase();
        vb = String(vb || '').toLowerCase();
      }
      if (va < vb) return -1 * sortDir;
      if (va > vb) return  1 * sortDir;
      return 0;
    });
  }

  function renderTable() {
    var filtered = getFilteredApps();
    var sorted   = sortApps(filtered);
    var tbody    = document.getElementById('appsTableBody');
    var countEl  = document.getElementById('appsCount');

    if (countEl) countEl.textContent = sorted.length + ' application' + (sorted.length !== 1 ? 's' : '');

    if (!sorted.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="officer-table__empty">No applications match the current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.map(function (a) {
      return '<tr>' +
        '<td><code style="font-size:12px">' + esc(a.appId) + '</code></td>' +
        '<td>' +
          '<div style="font-weight:500">' + esc(a.displayName || '—') + '</div>' +
          '<div style="font-size:11.5px;color:#64748b">' + esc(a.phone || '') + '</div>' +
        '</td>' +
        '<td>' + esc(formatList(a.businessTypes)) + '</td>' +
        '<td><span class="officer-tier-badge">' + esc(TIER_LABELS[a.tier] || a.tier || '—') + '</span></td>' +
        '<td>' + statusBadge(a.applicationStatus) + '</td>' +
        '<td>' + formatDate(a.submittedAt) + '</td>' +
        '<td><a class="officer-table-link" href="/officer/applications/' + esc(a.appId) + '">View &rarr;</a></td>' +
        '</tr>';
    }).join('');
  }

  function setupFilters() {
    document.getElementById('appSearch').addEventListener('input', renderTable);
    document.getElementById('filterStatus').addEventListener('change', renderTable);
    document.getElementById('filterTier').addEventListener('change', renderTable);
    document.getElementById('filterClearBtn').addEventListener('click', function () {
      document.getElementById('appSearch').value = '';
      document.getElementById('filterStatus').value = '';
      document.getElementById('filterTier').value = '';
      renderTable();
    });
  }

  function setupSort() {
    document.querySelectorAll('#appsTable th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var col = th.getAttribute('data-col');
        if (sortCol === col) {
          sortDir = -sortDir;
        } else {
          sortCol = col;
          sortDir = -1;
        }
        renderTable();
      });
    });
  }

  document.addEventListener('officer-ready', function () {
    setupFilters();
    setupSort();

    firebase.firestore().collection('applications').get().then(function (snap) {
      allApps = snap.docs.map(function (d) { return d.data(); })
        .filter(function (a) { return a.applicationStatus !== 'approved'; });
      renderTable();
    }).catch(function (err) {
      console.error('[FOSCOS] applications load:', err);
      document.getElementById('appsTableBody').innerHTML =
        '<tr><td colspan="7" class="officer-table__empty">Failed to load applications.</td></tr>';
    });
  });

})();
