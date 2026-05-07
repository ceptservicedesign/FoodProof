(function () {
  'use strict';

  var allGrievances = [];
  var activeFilter  = 'all';

  var CATEGORY_LABELS = {
    'hygiene':       'Hygiene',
    'food-quality':  'Food Quality',
    'mislabelling':  'Mislabelling',
    'adulteration':  'Adulteration'
  };

  var STATUS_KEYS = {
    'Resolved':             'resolved',
    'Action Taken':         'approved',
    'Inspection Scheduled': 'inspection_scheduled',
    'Under Review':         'inspection_scheduled',
    'Submitted':            'submitted'
  };

  document.addEventListener('officer-ready', function () {
    loadGrievances();
    wireFilterTabs();
  });

  function loadGrievances() {
    firebase.firestore()
      .collection('grievances')
      .get()
      .then(function (snap) {
        allGrievances = snap.docs
          .map(function (d) { return Object.assign({ _id: d.id }, d.data()); })
          .sort(function (a, b) {
            var ta = a.filedAt && a.filedAt.seconds ? a.filedAt.seconds : 0;
            var tb = b.filedAt && b.filedAt.seconds ? b.filedAt.seconds : 0;
            return tb - ta;
          });
        updateCounts();
        render();
      })
      .catch(function (err) {
        document.getElementById('grvBody').innerHTML =
          '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">Failed to load grievances.</td></tr>';
        console.error('[officer-grievances]', err);
      });
  }

  function updateCounts() {
    var counts = { all: allGrievances.length, Submitted: 0, 'Under Review': 0, 'Inspection Scheduled': 0, 'Action Taken': 0, Resolved: 0 };
    allGrievances.forEach(function (g) {
      if (counts[g.status] !== undefined) counts[g.status]++;
    });
    var el;
    el = document.getElementById('grvCountAll');        if (el) el.textContent = counts['all'] || '';
    el = document.getElementById('grvCountSubmitted');  if (el) el.textContent = counts['Submitted'] || '';
    el = document.getElementById('grvCountReview');     if (el) el.textContent = counts['Under Review'] || '';
    el = document.getElementById('grvCountInspection'); if (el) el.textContent = counts['Inspection Scheduled'] || '';
    el = document.getElementById('grvCountDone');       if (el) el.textContent = counts['Action Taken'] || '';
    el = document.getElementById('grvCountResolved');   if (el) el.textContent = counts['Resolved'] || '';

    var badge = document.getElementById('sidebarGrvBadge');
    if (badge) {
      var open = counts['Submitted'] + counts['Under Review'] + counts['Inspection Scheduled'];
      if (open > 0) { badge.textContent = open; badge.style.display = ''; }
      else { badge.style.display = 'none'; }
    }
  }

  function wireFilterTabs() {
    document.querySelectorAll('.officer-grv-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.officer-grv-tab').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeFilter = btn.dataset.status;
        render();
      });
    });
  }

  function render() {
    var list = activeFilter === 'all'
      ? allGrievances
      : allGrievances.filter(function (g) { return g.status === activeFilter; });

    if (!list.length) {
      document.getElementById('grvBody').innerHTML =
        '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">No grievances found.</td></tr>';
      return;
    }

    var rows = list.map(function (g) {
      var filed = g.filedAt && g.filedAt.toDate
        ? g.filedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
      var statusKey = STATUS_KEYS[g.status] || 'submitted';
      var comment = (g.comment || '').length > 60
        ? g.comment.slice(0, 60) + '…'
        : (g.comment || '');
      return '<tr>' +
        '<td>' + filed + '</td>' +
        '<td><strong>' + esc(g.restaurantName) + '</strong><br>' +
          '<small style="color:var(--text-muted)">' + esc(g.restaurantId || '') + '</small></td>' +
        '<td>' + esc(CATEGORY_LABELS[g.category] || g.category || '—') + '</td>' +
        '<td style="font-weight:600">' + (g.overall || '—') + ' / 5</td>' +
        '<td>' + esc(g.consumerName || '—') + '<br>' +
          '<small style="color:var(--text-muted)">' + esc(g.consumerPhone || '') + '</small></td>' +
        '<td class="officer-grv-comment">' + esc(comment) + '</td>' +
        '<td><span class="officer-badge officer-badge--' + statusKey + '">' + esc(g.status || '—') + '</span></td>' +
        '<td><a class="officer-table-link" href="/officer/grievances/' + esc(g._id) + '">View &rarr;</a></td>' +
      '</tr>';
    }).join('');

    document.getElementById('grvBody').innerHTML = rows;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
