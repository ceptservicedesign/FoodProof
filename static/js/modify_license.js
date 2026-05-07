(function () {
  'use strict';

  var DOC_LABELS = {
    selfie:          'Photo of Applicant',
    idProof:         'Identity Proof',
    addressProof:    'Address Proof',
    form9:           'Form IX',
    blueprint:       'Premises Blueprint',
    waterTestReport: 'Water Analysis Report',
    nocFireDept:     'NOC from Fire Department'
  };

  var uid      = null;
  var appId    = null;
  var userData = null;

  function getVal(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function fill(id, v) {
    var el = document.getElementById(id);
    if (el) el.value = v || '';
  }

  function getRequiredDocs(tier) {
    var required = ['selfie'];
    if (tier !== 'temporary-basic') required.push('idProof', 'addressProof');
    if (tier === 'state' || tier === 'central') required.push('form9', 'blueprint', 'waterTestReport');
    if (tier === 'central') required.push('nocFireDept');
    return required;
  }

  /* ── Render document list ─────────────────────────────────── */

  function renderDocs(docs, tier) {
    var required = getRequiredDocs(tier || 'basic');
    var listEl   = document.getElementById('mlDocList');
    if (!listEl) return;

    listEl.innerHTML = required.map(function (key) {
      var present     = !!(docs && docs[key]);
      var statusColor = present ? '#16a34a' : '#b45309';
      var statusText  = present ? 'Uploaded' : 'Not uploaded';
      var btnText     = present ? 'Re-upload' : 'Upload';
      return '<div style="display:flex;align-items:center;justify-content:space-between;' +
             'padding:13px 0;border-bottom:1px solid var(--border);">' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<span style="font-size:20px;flex-shrink:0;">' + (present ? '✅' : '○') + '</span>' +
          '<div>' +
            '<div style="font-size:13.5px;font-weight:600;color:var(--navy);">' +
              (DOC_LABELS[key] || key) +
            '</div>' +
            '<div style="font-size:12px;color:' + statusColor + ';margin-top:2px;">' +
              statusText +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button class="fbo-btn-secondary" data-dockey="' + key + '" ' +
          'style="font-size:12px;padding:6px 16px;cursor:pointer;">' +
          btnText +
        '</button>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('[data-dockey]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-dockey');
        btn.disabled    = true;
        btn.textContent = 'Uploading…';
        var patch = {};
        patch['documents.' + key] = true;
        firebase.firestore().collection('users').doc(uid).update(patch)
          .then(function () {
            if (!userData.documents) userData.documents = {};
            userData.documents[key] = true;
            renderDocs(userData.documents, userData.scale && userData.scale.tier);
          })
          .catch(function (err) {
            console.error('[modify-license] doc upload:', err);
            btn.disabled    = false;
            btn.textContent = 'Upload';
          });
      });
    });
  }

  /* ── Save changes ─────────────────────────────────────────── */

  function saveChanges() {
    var errEl = document.getElementById('mlError');
    var btn   = document.getElementById('mlSaveBtn');

    var bizName  = getVal('mlBizName');
    var ownerName = getVal('mlOwnerName');
    var bizPhone  = getVal('mlBizPhone');
    var addrLine1 = getVal('mlAddrLine1');
    var pincode   = getVal('mlPincode');
    var district  = getVal('mlDistrict');
    var state     = getVal('mlState');

    if (!bizName) {
      if (errEl) errEl.textContent = 'Business name is required.';
      return;
    }
    if (errEl) errEl.textContent = '';
    var isResubmission = userData.applicationStatus === 'documents_requested';
    btn.disabled    = true;
    btn.textContent = isResubmission ? 'Resubmitting…' : 'Saving…';

    var detailsUpdate = {
      bizName:      bizName,
      ownerName:    ownerName,
      bizPhone:     bizPhone,
      addrLine1:    addrLine1,
      addrPincode:  pincode,
      addrDistrict: district,
      addrState:    state
    };

    var db  = firebase.firestore();
    var ts  = firebase.firestore.FieldValue.serverTimestamp();
    var p   = db.collection('users').doc(uid).set({ details: detailsUpdate, updatedAt: ts }, { merge: true });

    if (isResubmission && appId) {
      var auditEntry = {
        action:    'FBO updated details and resubmitted',
        by:        'fbo',
        statusKey: 'submitted',
        timestamp: new Date().toISOString()
      };
      p = p.then(function () {
        var batch   = db.batch();
        var appRef  = db.collection('applications').doc(appId);
        var userRef = db.collection('users').doc(uid);
        batch.set(appRef,
          { details: detailsUpdate, applicationStatus: 'submitted', updatedAt: ts,
            auditTrail: firebase.firestore.FieldValue.arrayUnion(auditEntry) },
          { merge: true });
        batch.set(userRef, { applicationStatus: 'submitted', updatedAt: ts }, { merge: true });
        return batch.commit();
      });
    } else if (appId && userData.applicationStatus === 'approved') {
      p = p.then(function () {
        return db.collection('applications').doc(appId).set(
          { details: detailsUpdate, updatedAt: ts },
          { merge: true }
        );
      });
    }

    p.then(function () {
      document.getElementById('modifyForm').style.display    = 'none';
      document.getElementById('modifyConfirm').style.display = '';
      window.scrollTo(0, 0);
    }).catch(function (err) {
      console.error('[modify-license] save:', err);
      btn.disabled    = false;
      btn.textContent = isResubmission ? 'Save & Resubmit →' : 'Save Changes';
      if (errEl) errEl.textContent = 'Could not save. Please try again.';
    });
  }

  /* ── Boot ─────────────────────────────────────────────────── */

  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }
      uid = user.uid;

      firebase.firestore().collection('users').doc(uid).get()
        .then(function (doc) {
          if (!doc.exists) { window.location.href = '/fbo-portal'; return; }
          userData = doc.data();
          appId    = userData.applicationId || null;

          var det = userData.details || {};
          fill('mlBizName',   det.bizName);
          fill('mlOwnerName', det.ownerName);
          fill('mlBizPhone',  det.bizPhone);
          fill('mlAddrLine1', det.addrLine1);
          fill('mlPincode',   det.addrPincode);
          fill('mlDistrict',  det.addrDistrict);
          fill('mlState',     det.addrState);

          renderDocs(userData.documents, userData.scale && userData.scale.tier);

          document.getElementById('modifyLoading').style.display = 'none';
          document.getElementById('modifyForm').style.display    = '';

          var saveBtn = document.getElementById('mlSaveBtn');
          if (saveBtn) {
            if (userData.applicationStatus === 'documents_requested') {
              saveBtn.textContent = 'Save & Resubmit →';
            }
            saveBtn.addEventListener('click', saveChanges);
          }
        })
        .catch(function () { window.location.href = '/fbo-portal'; });
    });
  });

})();
