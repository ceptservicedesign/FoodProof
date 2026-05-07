(function () {
  'use strict';

  var CATEGORY_LABELS = {
    'hygiene':      'Hygiene',
    'food-quality': 'Food Quality',
    'mislabelling': 'Mislabelling',
    'adulteration': 'Adulteration'
  };

  var STATUS_BADGE_CLS = {
    'Resolved':             'fbo-complaint-status--done',
    'Action Taken':         'fbo-complaint-status--done',
    'Inspection Scheduled': 'fbo-complaint-status--review',
    'Under Review':         'fbo-complaint-status--review',
    'Submitted':            'fbo-complaint-status--pending'
  };

  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }

      firebase.firestore().collection('users').doc(user.uid).get()
        .then(function (doc) {
          if (!doc.exists) { window.location.href = '/about-business'; return; }
          var d = doc.data();
          var appId = d.applicationId;
          if (!appId) { window.location.href = '/fbo-portal'; return; }

          var el = document.getElementById('grvRestaurantId');
          if (el) el.textContent = appId;

          loadComplaints(appId);
        })
        .catch(function () { window.location.href = '/'; });
    });
  });

  function loadComplaints(appId) {
    firebase.firestore()
      .collection('grievances')
      .where('restaurantId', '==', appId)
      .get()
      .then(function (snap) {
        document.getElementById('grvLoading').style.display = 'none';

        if (snap.empty) {
          document.getElementById('grvEmpty').style.display = '';
          return;
        }

        var complaints = snap.docs
          .map(function (d) { return Object.assign({ _id: d.id }, d.data()); })
          .sort(function (a, b) {
            var ta = a.filedAt && a.filedAt.seconds ? a.filedAt.seconds : 0;
            var tb = b.filedAt && b.filedAt.seconds ? b.filedAt.seconds : 0;
            return tb - ta;
          });

        renderList(complaints);
      })
      .catch(function (err) {
        console.error('[fbo-grievances]', err);
        document.getElementById('grvLoading').textContent = 'Failed to load complaints.';
      });
  }

  function renderList(complaints) {
    var listEl = document.getElementById('grvList');
    listEl.style.display = '';

    var html = '';
    complaints.forEach(function (g) {
      var filed = g.filedAt && g.filedAt.toDate
        ? g.filedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
      var statusCls = STATUS_BADGE_CLS[g.status] || 'fbo-complaint-status--pending';
      var hasResponse = g.fboResponse && g.fboResponse.comment;
      var r = g.ratings || {};

      html += '<a href="/fbo-grievances/' + esc(g._id) + '" class="fbo-complaint-card fbo-complaint-card--clickable" style="text-decoration:none;display:block;">' +
        '<div class="fbo-complaint-meta">' +
          '<span class="fbo-complaint-category">' + esc(CATEGORY_LABELS[g.category] || g.category || '—') + '</span>' +
          '<span class="fbo-complaint-date">' + filed + '</span>' +
          '<span class="fbo-complaint-status ' + statusCls + '">' + esc(g.status || '—') + '</span>' +
        '</div>' +
        '<div class="fbo-complaint-ratings">' +
          '<span>Cleanliness: <strong>' + (r.cleanliness || '—') + '/5</strong></span>' +
          '<span>Freshness: <strong>'   + (r.freshness   || '—') + '/5</strong></span>' +
          '<span>Hygiene: <strong>'     + (r.hygiene     || '—') + '/5</strong></span>' +
          '<span>Overall: <strong>'     + (g.overall     || '—') + '/5</strong></span>' +
        '</div>' +
        (g.comment ? '<div class="fbo-complaint-comment">"' + esc(g.comment) + '"</div>' : '') +
        '<div class="fbo-complaint-footer">' +
          (hasResponse
            ? '<span class="fbo-complaint-responded">✔ Response submitted</span>'
            : '<span class="fbo-complaint-respond-cta">Tap to view &amp; respond →</span>') +
        '</div>' +
      '</a>';
    });

    listEl.innerHTML = html;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
