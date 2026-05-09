(function () {
  'use strict';

  var TIER_LABELS = {
    'temporary-basic': 'Basic Reg.',
    'basic': 'State (Basic)',
    'state': 'State',
    'central': 'Central'
  };

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function score(fboGrievances, fssaiRating) {
    var baseRating = typeof fssaiRating === 'number' ? fssaiRating : 5;
    var total = fboGrievances.length;
    if (total === 0) {
      var s0 = Math.min(100, Math.round((baseRating / 5) * 50 + 20));
      return { score: s0, avgRating: baseRating.toFixed(1), resolved: 0, total: 0 };
    }

    var resolved    = fboGrievances.filter(function (g) { return g.status === 'Resolved'; }).length;
    var ratingPts   = (baseRating / 5) * 50;
    var resolvedPts = (resolved / total) * 30;
    var cleanBonus  = Math.max(0, 20 - total * 4);
    var total_score = Math.min(100, Math.round(ratingPts + resolvedPts + cleanBonus));

    return { score: total_score, avgRating: baseRating.toFixed(1), resolved: resolved, total: total };
  }

  function badge(s) {
    if (s >= 80) return { label: 'Excellent', color: '#15803d', bg: '#f0fdf4' };
    if (s >= 60) return { label: 'Good',      color: '#1d4ed8', bg: '#eff6ff' };
    if (s >= 40) return { label: 'Average',   color: '#b45309', bg: '#fffbeb' };
    return            { label: 'Needs Work',  color: '#dc2626', bg: '#fef2f2' };
  }

  function render(fbos, grievances) {
    var ranked = fbos.map(function (fbo) {
      var fboGrvs = grievances.filter(function (g) { return g.restaurantId === fbo.appId; });
      var s = score(fboGrvs, fbo.fssaiRating);
      return Object.assign({}, fbo, s);
    }).sort(function (a, b) { return b.score - a.score; });

    /* Leader card */
    if (ranked.length) {
      var leader = ranked[0];
      var bd = badge(leader.score);
      document.getElementById('cklLeaderName').textContent = leader.bizName;
      document.getElementById('cklLeaderSub').textContent  =
        (TIER_LABELS[leader.tier] || leader.tier || '—') + '  ·  Score: ' + leader.score + '/100';
      document.getElementById('cklLeaderScore').textContent = leader.score;
      document.getElementById('cklLeaderCard').style.display = '';
      document.getElementById('cklLeaderCard').style.borderLeft = '4px solid ' + bd.color;
    }

    var countEl = document.getElementById('cklCount');
    if (countEl) countEl.textContent = ranked.length + ' registered FBO' + (ranked.length !== 1 ? 's' : '');

    var MEDALS = ['🥇', '🥈', '🥉'];

    document.getElementById('cklTableBody').innerHTML = ranked.map(function (fbo, i) {
      var bd  = badge(fbo.score);
      var pct = fbo.score + '%';
      return '<tr>' +
        '<td style="font-size:16px;text-align:center;">' + (MEDALS[i] || (i + 1)) + '</td>' +
        '<td>' +
          '<div style="font-weight:600;color:var(--navy);">' + esc(fbo.bizName) + '</div>' +
          '<div style="font-size:11.5px;color:var(--text-muted);">' + esc(fbo.appId) + '</div>' +
        '</td>' +
        '<td style="font-weight:600;">' + fbo.avgRating + ' / 5</td>' +
        '<td>' + fbo.total + '</td>' +
        '<td>' + fbo.resolved + ' / ' + fbo.total + '</td>' +
        '<td>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="flex:1;background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;">' +
              '<div style="height:100%;background:' + bd.color + ';width:' + pct + ';border-radius:99px;transition:width .4s;"></div>' +
            '</div>' +
            '<span style="font-size:13px;font-weight:700;color:var(--navy);min-width:28px;">' + fbo.score + '</span>' +
            '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:' + bd.bg + ';color:' + bd.color + ';">' + bd.label + '</span>' +
          '</div>' +
        '</td>' +
        '<td><a class="officer-table-link" href="/officer/fbo-directory/' + esc(fbo.appId) + '">View →</a></td>' +
      '</tr>';
    }).join('');

    document.getElementById('cklLoading').style.display   = 'none';
    document.getElementById('cklTableWrap').style.display = '';
  }

  document.addEventListener('officer-ready', function () {
    var d = new Date();
    var dateEl = document.getElementById('cklDate');
    if (dateEl) dateEl.textContent = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    var fbos, grievances;

    firebase.firestore().collection('applications')
      .where('applicationStatus', '==', 'approved')
      .get()
      .then(function (snap) {
        fbos = snap.docs.map(function (d) {
          var data = d.data();
          return {
            appId:       data.appId || d.id,
            bizName:     (data.details && data.details.bizName) || data.displayName || '—',
            tier:        data.scale && data.scale.tier,
            fssaiRating: typeof data.fssaiRating === 'number' ? data.fssaiRating : null,
          };
        });
        return firebase.firestore().collection('grievances').get();
      })
      .then(function (snap) {
        grievances = snap.docs.map(function (d) { return d.data(); });
        render(fbos, grievances);
      })
      .catch(function (err) {
        console.error('[ckl]', err);
        document.getElementById('cklLoading').textContent = 'Failed to load data.';
      });
  });

})();
