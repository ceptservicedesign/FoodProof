(function () {
  'use strict';

  var allFbos      = [];
  var selectedFbo  = null;
  var currentOfficer = 'FSO';

  var CATEGORY_LABELS = {
    'packaged_food': 'Packaged Food',
    'raw_material':  'Raw Material',
    'cooked_food':   'Cooked / Ready-to-Eat',
    'beverages':     'Beverages',
    'dairy':         'Dairy Products',
    'oil_fat':       'Oils & Fats',
    'spices':        'Spices & Condiments',
    'water':         'Water / Ice',
    'other':         'Other'
  };

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : new Date());
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  /* ── FBO typeahead ─────────────────────────────────────────── */

  function wireFboSearch() {
    var input    = document.getElementById('smpFboInput');
    var dropdown = document.getElementById('smpFboDropdown');
    var hiddenId = document.getElementById('smpFboId');

    input.addEventListener('input', function () {
      selectedFbo = null;
      hiddenId.value = '';
      var q = input.value.toLowerCase();
      if (!q) { dropdown.style.display = 'none'; return; }

      var matches = allFbos.filter(function (f) {
        return (f.bizName + ' ' + f.appId).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);

      if (!matches.length) { dropdown.style.display = 'none'; return; }

      dropdown.innerHTML = matches.map(function (f) {
        return '<div class="smp-fbo-option" data-id="' + esc(f.appId) + '" data-name="' + esc(f.bizName) + '" ' +
          'style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);">' +
          '<div style="font-weight:600;font-size:13px;">' + esc(f.bizName) + '</div>' +
          '<div style="font-size:11.5px;color:var(--text-muted);">' + esc(f.appId) + '</div>' +
        '</div>';
      }).join('');
      dropdown.style.display = '';

      dropdown.querySelectorAll('.smp-fbo-option').forEach(function (opt) {
        opt.addEventListener('click', function () {
          input.value      = opt.dataset.name;
          hiddenId.value   = opt.dataset.id;
          selectedFbo      = { appId: opt.dataset.id, bizName: opt.dataset.name };
          dropdown.style.display = 'none';
        });
        opt.addEventListener('mouseover', function () { opt.style.background = 'var(--cream-2)'; });
        opt.addEventListener('mouseout',  function () { opt.style.background = ''; });
      });
    });

    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
    });
  }

  /* ── Submit ────────────────────────────────────────────────── */

  function wireSubmit() {
    document.getElementById('smpSubmitBtn').addEventListener('click', function () {
      var btn     = document.getElementById('smpSubmitBtn');
      var errEl   = document.getElementById('smpError');
      var savedEl = document.getElementById('smpSavedMsg');
      errEl.textContent = '';
      savedEl.style.display = 'none';

      var fboId   = document.getElementById('smpFboId').value.trim();
      var fboName = document.getElementById('smpFboInput').value.trim();
      var cat     = document.getElementById('smpCategory').value;
      var item    = document.getElementById('smpItem').value.trim();
      var qty     = document.getElementById('smpQty').value.trim();
      var dt      = document.getElementById('smpDateTime').value;
      var notes   = document.getElementById('smpNotes').value.trim();

      if (!fboId)   { errEl.textContent = 'Please select a registered FBO.'; return; }
      if (!cat)     { errEl.textContent = 'Please select a sample category.'; return; }
      if (!item)    { errEl.textContent = 'Please enter the sample collected.'; return; }
      if (!qty)     { errEl.textContent = 'Please enter quantity collected.'; return; }
      if (!dt)      { errEl.textContent = 'Please enter the collection date and time.'; return; }

      btn.disabled    = true;
      btn.textContent = 'Saving…';

      var record = {
        restaurantId:   fboId,
        restaurantName: fboName,
        category:       cat,
        sampleItem:     item,
        quantity:       qty,
        collectedAt:    dt,
        notes:          notes || '',
        recordedBy:     currentOfficer,
        createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
        labStatus:      'pending'
      };

      firebase.firestore().collection('samples').add(record)
        .then(function () {
          btn.disabled    = false;
          btn.textContent = 'Record Sample';
          savedEl.style.display = '';
          setTimeout(function () { savedEl.style.display = 'none'; }, 3000);
          /* Reset form */
          document.getElementById('smpFboInput').value  = '';
          document.getElementById('smpFboId').value     = '';
          document.getElementById('smpCategory').value  = '';
          document.getElementById('smpItem').value      = '';
          document.getElementById('smpQty').value       = '';
          document.getElementById('smpDateTime').value  = '';
          document.getElementById('smpNotes').value     = '';
          selectedFbo = null;
          loadRecent();
        })
        .catch(function (err) {
          console.error('[sampling]', err);
          errEl.textContent   = 'Could not save. Please try again.';
          btn.disabled        = false;
          btn.textContent     = 'Record Sample';
        });
    });
  }

  /* ── Recent samples list ───────────────────────────────────── */

  function loadRecent() {
    firebase.firestore().collection('samples')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()
      .then(function (snap) {
        var el = document.getElementById('smpRecentList');
        if (snap.empty) {
          el.innerHTML = '<p style="font-size:13px;color:var(--text-muted);">No samples recorded yet.</p>';
          return;
        }
        el.innerHTML = snap.docs.map(function (d) {
          var s = d.data();
          return '<div style="padding:10px 0;border-bottom:1px solid var(--border);">' +
            '<div style="font-size:13px;font-weight:600;color:var(--navy);">' + esc(s.sampleItem || '—') + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);margin:2px 0;">' +
              esc(s.restaurantName || '—') + ' &bull; ' + esc(CATEGORY_LABELS[s.category] || s.category || '—') +
            '</div>' +
            '<div style="font-size:11.5px;color:var(--text-muted);">' + esc(s.quantity) + ' &bull; ' + esc(s.collectedAt) + '</div>' +
          '</div>';
        }).join('');
      })
      .catch(function (err) {
        console.error('[sampling] load recent:', err);
        document.getElementById('smpRecentList').innerHTML = '<p style="font-size:13px;color:var(--text-muted);">Failed to load.</p>';
      });
  }

  /* ── Boot ──────────────────────────────────────────────────── */

  document.addEventListener('officer-ready', function (e) {
    if (e.detail && e.detail.officer && e.detail.officer.displayName) {
      currentOfficer = e.detail.officer.displayName;
    }

    wireFboSearch();
    wireSubmit();

    /* Pre-load approved FBOs for typeahead */
    firebase.firestore().collection('applications')
      .where('applicationStatus', '==', 'approved')
      .get()
      .then(function (snap) {
        allFbos = snap.docs.map(function (d) {
          var data = d.data();
          return {
            appId:   data.appId || d.id,
            bizName: (data.details && data.details.bizName) || data.displayName || data.appId || d.id
          };
        });
      });

    loadRecent();
  });

})();
