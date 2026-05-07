/* ============================================================
   BUSINESS_DETAILS.JS — P09 Premises details, photos, EXIF GPS
   ============================================================ */
(function () {
  'use strict';

  var gpsCoords   = null;
  var photo1Data  = null;
  var photo2Data  = null;

  var ID_CONFIG = {
    aadhaar:  { label: 'Aadhaar Number',        placeholder: '12-digit number',       inputmode: 'numeric', maxlength: '12',  hint: 'Stored securely — used for identity verification only.' },
    pan:      { label: 'PAN Card Number',        placeholder: 'e.g. ABCDE1234F',       inputmode: 'text',    maxlength: '10',  hint: 'Enter your 10-character PAN exactly as printed.' },
    passport: { label: 'Passport Number',        placeholder: 'e.g. A1234567',         inputmode: 'text',    maxlength: '8',   hint: 'As printed on the first page of your passport.' },
    voter:    { label: 'Voter ID Number',        placeholder: 'e.g. ABC1234567',       inputmode: 'text',    maxlength: '10',  hint: 'Epic number printed on your Voter ID card.' },
    dl:       { label: 'Driving Licence Number', placeholder: 'e.g. DL0420110012345', inputmode: 'text',    maxlength: '20',  hint: 'As shown on your driving licence.' },
    govtid:   { label: 'Employee ID Number',     placeholder: 'Your employee ID',      inputmode: 'text',    maxlength: '30',  hint: 'Government employee ID issued by your department.' }
  };

  function applyIdConfig(type) {
    var cfg    = ID_CONFIG[type];
    var input  = document.getElementById('idProofNumber');
    var label  = document.getElementById('idProofNumberLabel');
    var hint   = document.getElementById('idProofHint');
    if (!input) return;
    if (cfg) {
      input.placeholder    = cfg.placeholder;
      input.setAttribute('inputmode', cfg.inputmode);
      input.setAttribute('maxlength', cfg.maxlength);
      if (label) label.textContent = cfg.label;
      if (hint)  hint.textContent  = cfg.hint;
      input.value = '';
    } else {
      input.placeholder = 'Select an ID type above';
      input.removeAttribute('inputmode');
      input.removeAttribute('maxlength');
      if (label) label.textContent = 'ID Number';
      if (hint)  hint.textContent  = 'Stored securely and used for identity verification only.';
      input.value = '';
    }
  }

  // ── Fee display by license duration ──────────────────────────
  function updateDurationFee() {
    var user = firebase.auth().currentUser;
    if (!user) return;
    firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
      if (!doc.exists) return;
      var fee = doc.data().scale && doc.data().scale.fee;
      if (!fee) return;
      var years = parseInt(document.getElementById('licenseDuration').value) || 1;
      var total = fee * years;
      var note = document.getElementById('durationFeeNote');
      if (note) note.textContent = 'Total fee: ₹' + total.toLocaleString('en-IN') + ' for ' + years + (years === 1 ? ' year' : ' years');
    });
  }

  // ── Photo setup (compress + EXIF GPS from photo1) ─────────────
  function setupPhotoUpload(inputId, thumbId, isFirst) {
    var input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;

      if (isFirst && typeof exifr !== 'undefined') {
        exifr.gps(file).then(function (pos) {
          if (pos && pos.latitude && pos.longitude) {
            gpsCoords = { lat: pos.latitude, lng: pos.longitude };
            var tag  = document.getElementById('gpsTag');
            var text = document.getElementById('gpsText');
            if (tag)  tag.style.display  = 'inline-flex';
            if (text) text.textContent   = pos.latitude.toFixed(5) + ', ' + pos.longitude.toFixed(5);
          }
        }).catch(function () {});
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var MAX = 640;
          var w = img.width, h = img.height;
          if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          else if (h > MAX)     { w = Math.round(w * MAX / h); h = MAX; }
          var canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          var b64 = canvas.toDataURL('image/jpeg', 0.55);
          if (isFirst) { photo1Data = b64; } else { photo2Data = b64; }
          var thumb = document.getElementById(thumbId);
          if (thumb) { thumb.src = b64; thumb.style.display = ''; }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Show/hide PAN field based on license tier ─────────────────
  function checkTierForPAN() {
    var user = firebase.auth().currentUser;
    if (!user) return;
    firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
      if (!doc.exists) return;
      var tier = doc.data().scale && doc.data().scale.tier;
      var taxSection = document.getElementById('taxSection');
      if (taxSection) {
        taxSection.style.display = (tier === 'state' || tier === 'central') ? '' : 'none';
      }
      updateDurationFee();
    });
  }

  // ── Pre-fill from Firestore ───────────────────────────────────
  function prefillFields() {
    var user = firebase.auth().currentUser;
    if (!user) return;

    firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
      if (!doc.exists) return;
      var docData = doc.data();
      var d = docData.details;

      var ppEl = document.getElementById('personPhone');
      if (ppEl && !ppEl.value && docData.phone) {
        ppEl.value = docData.phone.replace(/^\+91/, '').trim();
      }

      if (!d) return;

      setValue('bizName',         d.bizName);
      setValue('ownerName',       d.ownerName);
      setValue('bizPhone',        d.bizPhone);
      setValue('personInCharge',  d.personInCharge);
      if (d.personPhone) setValue('personPhone', d.personPhone);
      if (d.idProofType) {
        setValue('idProofType', d.idProofType);
        applyIdConfig(d.idProofType);
        setValue('idProofNumber', d.idProofNumber);
      } else if (d.aadhaarNumber) {
        setValue('idProofType', 'aadhaar');
        applyIdConfig('aadhaar');
        setValue('idProofNumber', d.aadhaarNumber);
      }
      setValue('addrLine1',       d.addrLine1);
      setValue('addrPincode',     d.addrPincode);
      setValue('addrDistrict',    d.addrDistrict);
      setValue('addrState',       d.addrState);
      setValue('panNumber',       d.panNumber);
      setValue('gstNumber',       d.gstNumber);
      if (d.licenseDuration) setValue('licenseDuration', String(d.licenseDuration));

      if (d.photo1Base64) {
        photo1Data = d.photo1Base64;
        var t1 = document.getElementById('photo1Thumb');
        if (t1) { t1.src = d.photo1Base64; t1.style.display = ''; }
      }
      if (d.photo2Base64) {
        photo2Data = d.photo2Base64;
        var t2 = document.getElementById('photo2Thumb');
        if (t2) { t2.src = d.photo2Base64; t2.style.display = ''; }
      }
      if (d.gps) {
        gpsCoords = d.gps;
        var tag  = document.getElementById('gpsTag');
        var text = document.getElementById('gpsText');
        if (tag)  tag.style.display  = 'inline-flex';
        if (text) text.textContent   = d.gps.lat.toFixed(5) + ', ' + d.gps.lng.toFixed(5);
      }

      updateDurationFee();
    });
  }

  function setValue(id, val) {
    var el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  }

  // ── Validate ───────────────────────────────────────────────────
  function validate() {
    if (!val('bizName'))    return 'Please enter your business name.';
    if (!val('ownerName'))  return 'Please enter the owner name.';
    var phone = document.getElementById('bizPhone').value.trim().replace(/\D/g, '');
    if (phone.length !== 10) return 'Enter a valid 10-digit contact number.';
    if (!val('addrLine1'))  return 'Please enter your street address.';
    if (!val('addrPincode') || document.getElementById('addrPincode').value.length !== 6) {
      return 'Enter a valid 6-digit pincode.';
    }
    if (!val('addrState'))    return 'Please enter your state.';
    if (!val('addrDistrict')) return 'Please enter your district.';

    var idType   = document.getElementById('idProofType').value;
    var idNumber = document.getElementById('idProofNumber').value.trim();
    if (idType && idType === 'aadhaar' && idNumber && idNumber.replace(/\D/g, '').length !== 12) {
      return 'Aadhaar must be 12 digits.';
    }
    if (idType && idType === 'pan' && idNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(idNumber)) {
      return 'Enter a valid PAN number (e.g. ABCDE1234F).';
    }

    var taxSection = document.getElementById('taxSection');
    if (taxSection && taxSection.style.display !== 'none') {
      var pan = document.getElementById('panNumber').value.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return 'Enter a valid PAN number (e.g. ABCDE1234F).';
    }

    return null;
  }

  function val(id) {
    var el = document.getElementById(id);
    return el && el.value.trim();
  }

  // ── Save & continue ───────────────────────────────────────────
  function saveAndContinue() {
    var err = validate();
    if (err) { document.getElementById('detailsError').textContent = err; return; }
    document.getElementById('detailsError').textContent = '';

    var user = firebase.auth().currentUser;
    if (!user) { window.location.href = '/'; return; }

    var btn = document.getElementById('detailsContinueBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    var data = {
      bizName:        val('bizName'),
      ownerName:      val('ownerName'),
      bizPhone:       document.getElementById('bizPhone').value.trim().replace(/\D/g, ''),
      personInCharge: val('personInCharge') || '',
      personPhone:    document.getElementById('personPhone').value.trim().replace(/\D/g, '') || '',
      idProofType:    document.getElementById('idProofType').value || '',
      idProofNumber:  document.getElementById('idProofNumber').value.trim() || '',
      licenseDuration: parseInt(document.getElementById('licenseDuration').value) || 1,
      addrLine1:      val('addrLine1'),
      addrPincode:    val('addrPincode'),
      addrDistrict:   val('addrDistrict') || '',
      addrState:      val('addrState'),
      photo1Base64:   photo1Data || '',
      photo2Base64:   photo2Data || '',
      gps:            gpsCoords || null
    };

    var taxSection = document.getElementById('taxSection');
    if (taxSection && taxSection.style.display !== 'none') {
      data.panNumber = document.getElementById('panNumber').value.trim().toUpperCase();
      data.gstNumber = document.getElementById('gstNumber').value.trim().toUpperCase() || '';
    }

    firebase.firestore().collection('users').doc(user.uid).set({
      details:   data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    .then(function () {
      var params = new URLSearchParams(window.location.search);
      window.location.href = params.get('from') === 'review' ? '/review' : '/documents';
    })
    .catch(function (e) {
      console.error('[FOSCOS] Firestore save details:', e);
      document.getElementById('detailsError').textContent = 'Could not save. Please try again.';
      btn.disabled    = false;
      btn.textContent = 'Looks good, continue →';
    });
  }

  // ── Auth guard ────────────────────────────────────────────────
  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }
      prefillFields();
      checkTierForPAN();
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    setupPhotoUpload('premisesPhoto1', 'photo1Thumb', true);
    setupPhotoUpload('premisesPhoto2', 'photo2Thumb', false);

    var dur = document.getElementById('licenseDuration');
    if (dur) dur.addEventListener('change', updateDurationFee);

    var idTypeSelect = document.getElementById('idProofType');
    if (idTypeSelect) idTypeSelect.addEventListener('change', function () {
      applyIdConfig(idTypeSelect.value);
    });

    var btn = document.getElementById('detailsContinueBtn');
    if (btn) btn.addEventListener('click', saveAndContinue);

    var params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'review') {
      var cb = document.getElementById('detailsContinueBtn');
      if (cb) cb.textContent = 'Save & Back to Review →';
    }
  });

})();
