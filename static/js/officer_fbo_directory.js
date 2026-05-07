(function () {
  'use strict';

  var allFbos = [];

  var TIER_LABELS = {
    'temporary-basic': 'Basic Reg.',
    'basic':           'State (Basic)',
    'state':           'State',
    'central':         'Central'
  };

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function validUntil(submittedAt, years) {
    if (!submittedAt) return '—';
    var d = submittedAt.toDate ? submittedAt.toDate() : new Date(submittedAt);
    d.setFullYear(d.getFullYear() + (years || 1));
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function render() {
    var q = (document.getElementById('fboSearch').value || '').toLowerCase();
    var list = q
      ? allFbos.filter(function (f) {
          return [f.appId, f.bizName, f.addrDistrict].join(' ').toLowerCase().indexOf(q) !== -1;
        })
      : allFbos;

    var countEl = document.getElementById('fboCount');
    if (countEl) countEl.textContent = list.length + ' registered FBO' + (list.length !== 1 ? 's' : '');

    if (!list.length) {
      document.getElementById('fboTableBody').innerHTML =
        '<tr><td colspan="7" class="officer-table__empty">No registered FBOs found.</td></tr>';
      return;
    }

    document.getElementById('fboTableBody').innerHTML = list.map(function (f) {
      var grvBadge = f.grievanceCount
        ? '<span class="officer-badge officer-badge--inspection_scheduled" style="font-size:11px">' + f.grievanceCount + ' open</span>'
        : '<span style="color:#94a3b8;font-size:12px">None</span>';
      return '<tr>' +
        '<td><code style="font-size:12px">' + esc(f.appId) + '</code></td>' +
        '<td><div style="font-weight:500">' + esc(f.bizName) + '</div>' +
          '<div style="font-size:11.5px;color:#64748b">' + esc(f.ownerName || '') + '</div></td>' +
        '<td><span class="officer-tier-badge">' + esc(TIER_LABELS[f.tier] || f.tier || '—') + '</span></td>' +
        '<td>' + esc(f.addrDistrict || '—') + '</td>' +
        '<td>' + validUntil(f.submittedAt, f.licenseYears) + '</td>' +
        '<td>' + grvBadge + '</td>' +
        '<td><a class="officer-table-link" href="/officer/fbo-directory/' + esc(f.appId) + '">View →</a></td>' +
      '</tr>';
    }).join('');
  }

  document.addEventListener('officer-ready', function () {
    document.getElementById('fboSearch').addEventListener('input', render);

    firebase.firestore().collection('applications')
      .where('applicationStatus', '==', 'approved')
      .get()
      .then(function (snap) {
        var appIds = [];
        allFbos = snap.docs.map(function (d) {
          var data = d.data();
          appIds.push(data.appId || d.id);
          return {
            appId:        data.appId || d.id,
            bizName:      (data.details && data.details.bizName) || data.displayName || '—',
            ownerName:    data.details && data.details.ownerName,
            tier:         data.scale && data.scale.tier,
            addrDistrict: data.details && data.details.addrDistrict,
            submittedAt:  data.submittedAt,
            licenseYears: data.review && data.review.years,
            grievanceCount: 0
          };
        });

        /* Count open grievances per FBO */
        if (appIds.length) {
          firebase.firestore().collection('grievances').get().then(function (gSnap) {
            var open = ['Submitted', 'Under Review', 'Action Taken', 'Inspection Scheduled'];
            gSnap.docs.forEach(function (gd) {
              var g = gd.data();
              if (open.indexOf(g.status) === -1) return;
              var fbo = allFbos.find(function (f) { return f.appId === g.restaurantId; });
              if (fbo) fbo.grievanceCount++;
            });
            render();
          });
        } else {
          render();
        }
      })
      .catch(function (err) {
        console.error('[fbo-directory]', err);
        document.getElementById('fboTableBody').innerHTML =
          '<tr><td colspan="7" class="officer-table__empty">Failed to load.</td></tr>';
      });
  });

})();
