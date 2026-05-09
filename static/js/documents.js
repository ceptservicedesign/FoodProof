/* ============================================================
   DOCUMENTS.JS — P10 Accordion doc upload; real Firebase Storage
   ============================================================ */
(function () {
  'use strict';

  var uid         = null;
  var currentTier = null;
  var uploadedDocs = {};  // key → URL string (or true for legacy boolean)

  var DOC_SPECS = {
    idProof: {
      icon: '🪪', title: 'Photo ID Proof',
      desc: 'Aadhaar, PAN, Passport, Voter ID, or Driving Licence.',
      required: true,
      tiers: ['temporary-basic', 'basic', 'state', 'central'],
      expandContent: {
        detail: 'Any valid government-issued photo ID — Aadhaar Card, PAN Card, Passport, Voter ID, or Driving Licence is accepted.',
        guidance: 'Clear phone photos of the original are accepted — no scanning required. Ensure all four corners are visible and the text is legible. For Aadhaar and Driving Licence, upload both front and back sides in a single file.',
        buttons: [{ type: 'guide', label: 'Watch a Guide' }, { type: 'faq', label: 'Read FAQ' }]
      }
    },
    addressProof: {
      icon: '🏠', title: 'Proof of Premises',
      desc: 'Rent agreement, electricity bill, or NOC from property owner.',
      required: true,
      tiers: ['temporary-basic', 'basic', 'state', 'central'],
      expandContent: {
        detail: 'Document confirming your right to use the food premises — rent/lease agreement, electricity bill, or a No-Objection Certificate (NOC) from the property owner.',
        guidance: 'If you operate from a shared or cloud kitchen, attach a sub-lease agreement or NOC from the kitchen operator. The address on this document must exactly match the address entered in your application.',
        buttons: [{ type: 'guide', label: 'Watch a Guide' }, { type: 'faq', label: 'Read FAQ' }]
      }
    },
    form9: {
      icon: '📋', title: 'Form IX — Nomination',
      desc: 'Signed nomination form for authorised signatory.',
      required: true,
      tiers: ['state', 'central'],
      expandContent: {
        detail: 'Form IX nominates the person authorised to sign FSSAI documents on behalf of your business entity.',
        guidance: 'Download the latest Form IX from the FSSAI website. Fill in the nominee\'s details completely, obtain the authorised signature and company stamp, then upload a clear photo or scan.',
        buttons: [{ type: 'guide', label: 'Watch a Guide' }]
      }
    },
    blueprint: {
      icon: '🗺️', title: 'Premises Blueprint',
      desc: 'Scaled floor plan showing kitchen, storage, and exit points.',
      required: true,
      tiers: ['state', 'central'],
      expandContent: {
        detail: 'A floor plan of your food premises showing the layout — kitchen area, food storage, washing zone, and entry/exit points. Dimensions and scale should be indicated.',
        guidance: 'A hand-drawn plan is acceptable for smaller premises. Use graph paper for easier scaling. Label each area clearly (cooking, dry storage, cold storage, wash area), note dimensions in feet or metres, and mark the main entry/exit.',
        buttons: [{ type: 'guide', label: 'Watch a Guide' }, { type: 'faq', label: 'Read FAQ' }]
      }
    },
    waterTestReport: {
      icon: '💧', title: 'Water Analysis Report',
      desc: 'NABL-accredited lab report, dated within last 6 months.',
      required: true,
      tiers: ['basic', 'state', 'central'],
      expandContent: {
        detail: 'A water potability report from an NABL-accredited laboratory confirming that water used in food preparation is safe for consumption.',
        guidance: 'The report must test for pH, coliform bacteria, TDS, and hardness — minimum 5 parameters. It must be dated within the last 6 months. Use the Book Lab Test button to schedule a lab visit directly from FOSCOS.',
        buttons: [{ type: 'guide', label: 'Watch a Guide' }, { type: 'faq', label: 'Read FAQ' }, { type: 'labtest', label: 'Book Lab Test' }]
      }
    },
    nocFireDept: {
      icon: '🔥', title: 'NOC — Fire Department',
      desc: 'Required for premises over 1000 sq ft.',
      required: false,
      tiers: ['central'],
      expandContent: {
        detail: 'A No-Objection Certificate from your local fire department, required for food premises over 1,000 sq ft or those with commercial cooking equipment, gas pipelines, or industrial appliances.',
        guidance: 'Apply in person at your nearest fire station with a floor plan and equipment list. Processing typically takes 7–15 working days. The NOC fee is paid directly to the fire department, not through FOSCOS.',
        buttons: [{ type: 'guide', label: 'Watch a Guide' }, { type: 'faq', label: 'Read FAQ' }]
      }
    }
  };

  // ── Upload a file to Firebase Storage ────────────────────────
  function uploadDoc(key, file, onDone, onError) {
    var path = 'documents/' + uid + '/' + key + '_' + Date.now();
    var ref  = firebase.storage().ref(path);
    ref.put(file).then(function () {
      return ref.getDownloadURL();
    }).then(function (url) {
      onDone(url);
    }).catch(function (e) {
      console.error('[FOSCOS] Storage upload ' + key + ':', e);
      onError(e);
    });
  }

  // ── Save URL to Firestore ─────────────────────────────────────
  function saveDocUrl(key, url) {
    var update = {};
    update['documents.' + key] = url;
    update['updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
    firebase.firestore().collection('users').doc(uid).update(update).catch(function (e) {
      console.error('[FOSCOS] Firestore save doc url:', e);
    });
  }

  // ── Update progress bar + sidebar ────────────────────────────
  function updateProgress() {
    var required = getRequiredKeys();
    var done = required.filter(function (k) { return !!uploadedDocs[k]; });
    var pct  = required.length ? Math.round((done.length / required.length) * 100) : 0;

    var bar   = document.getElementById('docsProgressBar');
    var label = document.getElementById('docsProgressLabel');
    if (bar)   bar.style.width = pct + '%';
    if (label) label.textContent = done.length + ' of ' + required.length + ' uploaded';

    var sideList = document.getElementById('uploadProgressList');
    if (!sideList) return;
    sideList.innerHTML = '';
    required.forEach(function (k) {
      var spec = DOC_SPECS[k];
      var isUploaded = !!uploadedDocs[k];
      var row = document.createElement('div');
      row.className = 'reg-docs-upload-row ' + (isUploaded ? 'uploaded' : 'pending');
      row.innerHTML = '<span class="status-dot"></span><span>' + spec.title + '</span>';
      sideList.appendChild(row);
    });
  }

  // ── Build upload cards ────────────────────────────────────────
  function buildDocList(tier) {
    currentTier = tier;
    var list = document.getElementById('docList');
    if (!list) return;
    list.innerHTML = '';

    var num = 0;
    Object.keys(DOC_SPECS).forEach(function (key) {
      var spec = DOC_SPECS[key];
      if (spec.tiers.indexOf(tier) === -1) return;
      num++;

      var isUploaded = !!uploadedDocs[key];
      var isOptional = !spec.required;
      var numStr     = num < 10 ? '0' + num : '' + num;

      var tagHtml = isOptional
        ? '<span class="reg-doc-item__tag optional">Optional</span>'
        : '';

      // ── Build expand / detail panel HTML ──────────────────────
      var ec = spec.expandContent || {};
      var btnsHtml = '';
      if (ec.buttons && ec.buttons.length) {
        btnsHtml = '<div class="reg-doc-card__helper-btns">';
        ec.buttons.forEach(function (b) {
          if (b.type === 'labtest') {
            btnsHtml += '<a class="reg-doc-card__helper-btn reg-doc-card__helper-btn--lab" href="/one-stop-shop">🧪 ' + b.label + '</a>';
          } else if (b.type === 'faq') {
            btnsHtml += '<button type="button" class="reg-doc-card__helper-btn" data-action="faq">📖 ' + b.label + '</button>';
          } else {
            btnsHtml += '<button type="button" class="reg-doc-card__helper-btn" data-action="guide">▶ ' + b.label + '</button>';
          }
        });
        btnsHtml += '</div>';
      }

      var detailHtml = (ec.detail || ec.guidance || btnsHtml)
        ? '<div class="reg-doc-card__detail" id="docDetail-' + key + '">' +
            '<div class="reg-doc-card__detail-body">' +
              (ec.detail   ? '<p class="reg-doc-card__detail-text">' + ec.detail + '</p>' : '') +
              (ec.guidance ? '<p class="reg-doc-card__detail-guidance"><strong>Submission tip:</strong> ' + ec.guidance + '</p>' : '') +
              btnsHtml +
            '</div>' +
          '</div>'
        : '';

      var card = document.createElement('div');
      card.className = 'reg-doc-card' + (isUploaded ? ' uploaded' : '');
      card.id        = 'docItem-' + key;

      card.innerHTML =
        '<div class="reg-doc-card__num" id="docNum-' + key + '">' +
          (isUploaded ? '✓' : numStr) +
        '</div>' +
        '<div class="reg-doc-card__body">' +
          '<div class="reg-doc-card__title">' + spec.icon + ' ' + spec.title +
            (tagHtml ? ' ' + tagHtml : '') +
          '</div>' +
          '<div class="reg-doc-card__desc">' + spec.desc + '</div>' +
          '<div class="reg-doc-card__status" id="docStatus-' + key + '">' +
            (isUploaded ? 'File uploaded successfully' : '') +
          '</div>' +
        '</div>' +
        '<label class="reg-doc-card__upload-btn' + (isUploaded ? ' done' : '') + '" id="docLabel-' + key + '">' +
          '<span id="docLabelText-' + key + '">' + (isUploaded ? '✓ Uploaded' : '⬆ Upload') + '</span>' +
          '<input type="file" class="reg-doc-card__file-input" id="docInput-' + key + '" accept="image/*,.pdf" data-key="' + key + '" />' +
        '</label>' +
        (detailHtml ? '<button type="button" class="reg-doc-card__expand-btn" id="docExpand-' + key + '" aria-label="Show guidance" aria-expanded="false"></button>' : '') +
        detailHtml;

      list.appendChild(card);

      // ── Expand / collapse ──────────────────────────────────────
      var expandBtn = document.getElementById('docExpand-' + key);
      if (expandBtn) {
        expandBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var cardEl = document.getElementById('docItem-' + key);
          var isOpen = cardEl.classList.contains('expanded');
          if (isOpen) {
            cardEl.classList.remove('expanded');
            expandBtn.setAttribute('aria-expanded', 'false');
          } else {
            cardEl.classList.add('expanded');
            expandBtn.setAttribute('aria-expanded', 'true');
          }
        });
      }

      // ── Helper button placeholders ────────────────────────────
      card.querySelectorAll('.reg-doc-card__helper-btn[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var action = btn.getAttribute('data-action');
          if (action === 'guide') {
            alert('Video guide coming soon.');
          } else if (action === 'faq') {
            alert('FAQ coming soon.');
          }
        });
      });

      // ── File input → upload ───────────────────────────────────
      var fileInput = document.getElementById('docInput-' + key);
      fileInput.addEventListener('change', function (e) {
        e.stopPropagation();
        var file = fileInput.files[0];
        if (!file) return;

        var labelEl   = document.getElementById('docLabel-' + key);
        var labelText = document.getElementById('docLabelText-' + key);
        var status    = document.getElementById('docStatus-' + key);
        var numEl     = document.getElementById('docNum-' + key);

        if (labelEl)   labelEl.className = 'reg-doc-card__upload-btn';
        if (labelText) labelText.textContent = '⏳ Uploading…';
        if (status)    status.textContent = '';

        uploadDoc(key, file, function (url) {
          uploadedDocs[key] = url;
          saveDocUrl(key, url);

          var cardEl = document.getElementById('docItem-' + key);
          if (cardEl)    { cardEl.classList.add('uploaded'); cardEl.classList.remove('expanded'); }
          if (numEl)     numEl.textContent = '✓';
          if (labelEl)   labelEl.className = 'reg-doc-card__upload-btn done';
          if (labelText) labelText.textContent = '✓ Uploaded';
          if (status)    status.textContent = file.name + ' — uploaded';

          document.getElementById('docsError').textContent = '';
          updateProgress();
        }, function () {
          if (labelEl)   labelEl.className = 'reg-doc-card__upload-btn';
          if (labelText) labelText.textContent = '⬆ Upload';
          if (status)    status.textContent = 'Upload failed — please try again';
        });
      });
    });

    updateProgress();
    setupWhatsApp();
  }

  function getRequiredKeys() {
    if (!currentTier) return [];
    return Object.keys(DOC_SPECS).filter(function (k) {
      return DOC_SPECS[k].tiers.indexOf(currentTier) !== -1 && DOC_SPECS[k].required;
    });
  }

  function allRequiredProvided() {
    return getRequiredKeys().every(function (k) { return !!uploadedDocs[k]; });
  }

  // ── WhatsApp checklist ────────────────────────────────────────
  function setupWhatsApp() {
    var btn = document.getElementById('whatsappChecklistBtn');
    if (!btn || !currentTier) return;
    var lines = ['*FOSCOS Document Checklist*', 'License tier: ' + currentTier, ''];
    Object.keys(DOC_SPECS).forEach(function (k) {
      if (DOC_SPECS[k].tiers.indexOf(currentTier) !== -1) {
        lines.push((uploadedDocs[k] ? '✅' : '⬜') + ' ' + DOC_SPECS[k].title);
      }
    });
    btn.href = 'https://wa.me/?text=' + encodeURIComponent(lines.join('\n'));
  }

  // ── Load from Firestore ───────────────────────────────────────
  function loadExisting(user) {
    uid = user.uid;
    firebase.firestore().collection('users').doc(uid).get().then(function (doc) {
      var d    = doc.exists ? doc.data() : {};
      var tier = (d.scale && d.scale.tier) || 'basic';

      if (d.documents) {
        Object.keys(d.documents).forEach(function (k) {
          if (d.documents[k]) uploadedDocs[k] = d.documents[k];
        });
      }

      buildDocList(tier);
    });
  }

  // ── Continue ─────────────────────────────────────────────────
  function continueFlow() {
    if (!allRequiredProvided()) {
      document.getElementById('docsError').textContent = 'Please upload all required documents before continuing.';
      return;
    }
    document.getElementById('docsError').textContent = '';
    var params = new URLSearchParams(window.location.search);
    window.location.href = params.get('from') === 'review' ? '/review' : '/one-stop-shop?from=documents';
  }

  // ── Auth guard ────────────────────────────────────────────────
  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }
      loadExisting(user);
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('docsContinueBtn');
    if (btn) btn.addEventListener('click', continueFlow);
  });

})();
