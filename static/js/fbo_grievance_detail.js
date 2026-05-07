(function () {
  'use strict';

  var grvId   = window.__GRV_ID__;
  var grvData = null;
  var fboAppId = null;

  var CATEGORY_LABELS = {
    'hygiene':      'Hygiene',
    'food-quality': 'Food Quality',
    'mislabelling': 'Mislabelling',
    'adulteration': 'Adulteration'
  };

  var STATUS_TO_STEP = {
    'Submitted':            'submitted',
    'Under Review':         'under_review',
    'Action Taken':         'action_taken',
    'Inspection Scheduled': 'inspection_scheduled',
    'Resolved':             'resolved'
  };

  var PIPELINE_ORDER = ['submitted', 'under_review', 'action_taken', 'inspection_scheduled', 'resolved'];

  var STATUS_BADGE_CLS = {
    'Resolved':             'fbo-complaint-status--done',
    'Action Taken':         'fbo-complaint-status--done',
    'Inspection Scheduled': 'fbo-complaint-status--review',
    'Under Review':         'fbo-complaint-status--review',
    'Submitted':            'fbo-complaint-status--pending'
  };

  /* ── Utilities ─────────────────────────────────────────────── */

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val || '—');
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ── Pipeline ──────────────────────────────────────────────── */

  function renderPipeline(status) {
    var stepSlug   = STATUS_TO_STEP[status] || 'submitted';
    var currentIdx = PIPELINE_ORDER.indexOf(stepSlug);

    document.querySelectorAll('#gdPipeline .fbo-grv-tracker__item').forEach(function (el) {
      var slug = el.dataset.step;
      var idx  = PIPELINE_ORDER.indexOf(slug);
      el.classList.remove('active', 'done');
      if (idx < currentIdx)  el.classList.add('done');
      if (idx === currentIdx) el.classList.add('active');
    });

    document.querySelectorAll('#gdPipeline .fbo-grv-tracker__seg').forEach(function (seg, i) {
      seg.classList.remove('done');
      if (i < currentIdx) seg.classList.add('done');
    });
  }

  /* ── Tab switching ─────────────────────────────────────────── */

  function setupTabs() {
    document.querySelectorAll('#gdTabs .fbo-grv-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#gdTabs .fbo-grv-tab').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.fbo-grv-tab-panel').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('tab' + capitalise(btn.dataset.tab)).classList.add('active');
      });
    });
  }

  function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ── Render tabs ───────────────────────────────────────────── */

  function renderDetails(g) {
    var r = g.ratings || {};
    var html =
      '<div class="fbo-grv-info-grid">' +
        infoItem('Category',    CATEGORY_LABELS[g.category] || g.category || '—') +
        infoItem('Overall Rating', (g.overall || '—') + ' / 5') +
        infoItem('Cleanliness', (r.cleanliness || '—') + ' / 5') +
        infoItem('Food Freshness', (r.freshness || '—') + ' / 5') +
        infoItem('Staff Hygiene', (r.hygiene || '—') + ' / 5') +
      '</div>';

    if (g.comment) {
      html += '<div class="fbo-grv-panel-label" style="margin-top:20px;margin-bottom:6px;">Consumer Comment</div>' +
        '<div class="fbo-grv-comment-box">"' + esc(g.comment) + '"</div>';
    }

    document.getElementById('gdDetailsGrid').innerHTML = html;
  }

  function renderHistory(g) {
    var hist = g.statusHistory;
    if (!hist || !hist.length) {
      document.getElementById('gdHistory').innerHTML =
        '<div class="fbo-grv-history-empty">No status updates yet.</div>';
      return;
    }
    var sorted = hist.slice().sort(function (a, b) {
      var ta = a.changedAt && a.changedAt.seconds ? a.changedAt.seconds : 0;
      var tb = b.changedAt && b.changedAt.seconds ? b.changedAt.seconds : 0;
      return tb - ta;
    });
    document.getElementById('gdHistory').innerHTML = sorted.map(function (h) {
      var cls = STATUS_BADGE_CLS[h.status] || 'fbo-complaint-status--pending';
      return '<div class="fbo-grv-history-row">' +
        '<span class="fbo-complaint-status ' + cls + '" style="font-size:11px;padding:3px 9px;">' + esc(h.status) + '</span>' +
        '<span class="fbo-grv-history-meta">' + formatDate(h.changedAt) + '</span>' +
      '</div>';
    }).join('');
  }

  function renderResponse(g) {
    var existingEl = document.getElementById('gdResponseExisting');
    var formEl     = document.getElementById('gdResponseForm');
    var fr = g.fboResponse;

    if (fr && fr.comment) {
      setText('gdResponseText', fr.comment);
      setText('gdResponseMeta', 'Submitted ' + formatDate(fr.submittedAt));
      existingEl.hidden = false;
      formEl.hidden     = true;
    } else {
      existingEl.hidden = true;
      formEl.hidden     = false;
      var inputEl = document.getElementById('gdResponseInput');
      if (inputEl) inputEl.value = '';
      var submitBtn = document.getElementById('gdResponseSubmit');
      if (submitBtn) submitBtn.textContent = 'Submit Response';
    }
  }

  function renderEvidence(g) {
    var listEl = document.getElementById('gdEvidenceList');
    var items  = g.fboEvidence || [];

    /* Classification buttons */
    var cls = g.fboClassification;
    if (cls === 'genuine') {
      document.getElementById('gdClsGenuine').classList.add('fbo-grv-classify-btn--active');
    } else if (cls === 'fake') {
      document.getElementById('gdClsFake').classList.add('fbo-grv-classify-btn--active');
    }

    if (!items.length) {
      listEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);margin-top:8px;">No evidence uploaded yet.</div>';
      return;
    }
    listEl.innerHTML = items.map(function (ev) {
      return '<div class="fbo-grv-evidence-item">' +
        '<span class="fbo-grv-evidence-icon">📄</span>' +
        '<div>' +
          '<div class="fbo-grv-evidence-name">' + esc(ev.fileName || 'File') + '</div>' +
          (ev.note ? '<div class="fbo-grv-evidence-note">' + esc(ev.note) + '</div>' : '') +
          '<div class="fbo-grv-evidence-date">' + formatDate(ev.uploadedAt) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function infoItem(label, value) {
    return '<div class="fbo-grv-info-item">' +
      '<div class="fbo-grv-panel-label">' + esc(label) + '</div>' +
      '<div class="fbo-grv-panel-value">' + esc(value) + '</div>' +
    '</div>';
  }

  /* ── Sidebar ───────────────────────────────────────────────── */

  function renderSidebar(g) {
    var cls = STATUS_BADGE_CLS[g.status] || 'fbo-complaint-status--pending';
    document.getElementById('gdSidebarStatus').innerHTML =
      '<span class="fbo-complaint-status ' + cls + '" style="font-size:13px;padding:5px 14px;">' + esc(g.status || '—') + '</span>';

    setText('gdMetaFiled',      formatDate(g.filedAt));
    setText('gdMetaCategory',   CATEGORY_LABELS[g.category] || g.category || '—');
    setText('gdMetaOverall',    (g.overall || '—') + ' / 5');
    setText('gdMetaInspection', g.inspectionDate || 'Not scheduled');
  }

  /* ── Wire response form ─────────────────────────────────────── */

  function wireResponse() {
    var editBtn   = document.getElementById('gdResponseEdit');
    var submitBtn = document.getElementById('gdResponseSubmit');
    var inputEl   = document.getElementById('gdResponseInput');
    var savedEl   = document.getElementById('gdResponseSaved');

    if (editBtn) {
      editBtn.addEventListener('click', function () {
        var fr = grvData && grvData.fboResponse;
        if (inputEl)   inputEl.value        = (fr && fr.comment) ? fr.comment : '';
        if (submitBtn) submitBtn.textContent = 'Update Response';
        document.getElementById('gdResponseExisting').hidden = true;
        document.getElementById('gdResponseForm').hidden     = false;
        if (inputEl) inputEl.focus();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var txt = (inputEl ? inputEl.value : '').trim();
        if (!txt) { alert('Please enter a response before submitting.'); return; }

        var isUpdate = !!(grvData && grvData.fboResponse && grvData.fboResponse.comment);
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Saving…';

        var responseObj = {
          comment:     txt,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
          submittedBy: fboAppId || 'FBO'
        };

        firebase.firestore().collection('grievances').doc(grvId).update({
          fboResponse: responseObj
        })
          .then(function () {
            grvData.fboResponse = Object.assign({}, responseObj, {
              submittedAt: { toDate: function () { return new Date(); }, seconds: Date.now() / 1000 }
            });
            submitBtn.disabled    = false;
            submitBtn.textContent = isUpdate ? 'Update Response' : 'Submit Response';
            if (savedEl) {
              savedEl.textContent = isUpdate ? '✔ Response updated' : '✔ Response submitted';
              savedEl.hidden = false;
              setTimeout(function () { savedEl.hidden = true; }, 3000);
            }
            renderResponse(grvData);
          })
          .catch(function (err) {
            console.error('[fbo-grv-detail] response:', err);
            submitBtn.disabled    = false;
            submitBtn.textContent = isUpdate ? 'Update Response' : 'Submit Response';
            alert('Could not save response. Please try again.');
          });
      });
    }
  }

  /* ── Wire classification ────────────────────────────────────── */

  function wireClassification() {
    document.querySelectorAll('.fbo-grv-classify-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.dataset.val;
        firebase.firestore().collection('grievances').doc(grvId).update({
          fboClassification: val
        })
          .then(function () {
            grvData.fboClassification = val;
            document.querySelectorAll('.fbo-grv-classify-btn').forEach(function (b) {
              b.classList.remove('fbo-grv-classify-btn--active');
            });
            btn.classList.add('fbo-grv-classify-btn--active');
            var savedEl = document.getElementById('gdClassifySaved');
            if (savedEl) {
              savedEl.textContent = '✔ Marked as ' + (val === 'genuine' ? 'Genuine' : 'Fake / Invalid');
              savedEl.hidden = false;
              setTimeout(function () { savedEl.hidden = true; }, 3000);
            }
          })
          .catch(function (err) { console.error('[fbo-grv-detail] classify:', err); });
      });
    });
  }

  /* ── Wire evidence upload (mock) ────────────────────────────── */

  function wireEvidence() {
    var browseBtn  = document.getElementById('gdEvidenceBrowse');
    var fileInput  = document.getElementById('gdEvidenceFile');

    if (browseBtn) {
      browseBtn.addEventListener('click', function () { fileInput.click(); });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        browseBtn.disabled    = true;
        browseBtn.textContent = 'Uploading…';

        var entry = {
          fileName:   file.name,
          note:       '',
          uploadedAt: firebase.firestore.Timestamp.fromDate(new Date())
        };

        firebase.firestore().collection('grievances').doc(grvId).update({
          fboEvidence: firebase.firestore.FieldValue.arrayUnion(entry)
        })
          .then(function () {
            if (!grvData.fboEvidence) grvData.fboEvidence = [];
            grvData.fboEvidence.push(entry);
            renderEvidence(grvData);
            browseBtn.disabled    = false;
            browseBtn.textContent = 'Browse Files';
            fileInput.value = '';
          })
          .catch(function (err) {
            console.error('[fbo-grv-detail] evidence:', err);
            browseBtn.disabled    = false;
            browseBtn.textContent = 'Browse Files';
          });
      });
    }
  }

  /* ── Boot ────────────────────────────────────────────────── */

  document.addEventListener('firebase-ready', function () {
    setupTabs();
    wireResponse();
    wireClassification();
    wireEvidence();

    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }

      firebase.firestore().collection('users').doc(user.uid).get()
        .then(function (userDoc) {
          if (!userDoc.exists) { window.location.href = '/about-business'; return; }
          fboAppId = userDoc.data().applicationId || null;

          return firebase.firestore().collection('grievances').doc(grvId).get();
        })
        .then(function (doc) {
          if (!doc.exists) { window.location.href = '/fbo-grievances'; return; }
          grvData = doc.data();

          /* Header */
          setText('gdHeaderId', doc.id);
          var catLabel = CATEGORY_LABELS[grvData.category] || grvData.category || '—';
          var filedStr = grvData.filedAt ? formatDate(grvData.filedAt) : '—';
          setText('gdHeaderMeta', catLabel + '  ·  Filed ' + filedStr);
          var cls = STATUS_BADGE_CLS[grvData.status] || 'fbo-complaint-status--pending';
          document.getElementById('gdHeaderBadge').innerHTML =
            '<span class="fbo-complaint-status ' + cls + '" style="font-size:13px;padding:5px 14px;">' + esc(grvData.status || '—') + '</span>';

          renderPipeline(grvData.status);
          renderSidebar(grvData);
          renderDetails(grvData);
          renderHistory(grvData);
          renderResponse(grvData);
          renderEvidence(grvData);
        })
        .catch(function (err) {
          console.error('[fbo-grv-detail]', err);
          window.location.href = '/fbo-grievances';
        });
    });
  });

})();
