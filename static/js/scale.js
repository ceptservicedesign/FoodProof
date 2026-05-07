/* ============================================================
   SCALE.JS — P08 Business Scale / Turnover Calculator
   ============================================================ */
(function () {
  'use strict';

  var currentTier     = null;
  var currentTurnover = 0;

  var TIER_FEES = {
    'temporary-basic': 0,
    'basic':           100,
    'state':           2000,
    'central':         7500
  };

  var TIER_LABELS = {
    'temporary-basic': 'Temporary Registration',
    'basic':           'Basic Registration',
    'state':           'State License',
    'central':         'Central License'
  };

  var TIER_BADGE_CLASS = {
    'temporary-basic': 'reg-tier-badge--temp',
    'basic':           'reg-tier-badge--basic',
    'state':           'reg-tier-badge--state',
    'central':         'reg-tier-badge--central'
  };

  var TIER_ROW_IDS = {
    'temporary-basic': 'tier-basic',
    'basic':           'tier-state-basic',
    'state':           'tier-state',
    'central':         'tier-central'
  };

  function getDaysPerWeek() {
    var el = document.getElementById('daysPerWeekInput');
    return Math.min(7, Math.max(1, parseInt(el && el.value) || 1));
  }

  function calcTurnover(daily, days, months) {
    return Math.round(daily * days * 4.3 * months);
  }

  function getTier(t) {
    if (t < 1000000)   return 'temporary-basic';
    if (t < 15000000)  return 'basic';
    if (t < 200000000) return 'state';
    return 'central';
  }

  function formatINR(n) {
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
    return '₹' + n.toLocaleString('en-IN');
  }

  function updateResult() {
    var daily    = parseFloat(document.getElementById('dailyRevenue').value) || 0;
    var dwRaw    = parseInt(document.getElementById('daysPerWeekInput').value);
    var myRaw    = parseInt(document.getElementById('monthsPerYear').value);

    var daysOk   = !isNaN(dwRaw) && dwRaw >= 1 && dwRaw <= 7;
    var monthsOk = !isNaN(myRaw) && myRaw >= 1 && myRaw <= 12;

    if (daily <= 0 || !daysOk || !monthsOk) {
      document.getElementById('turnoverAmount').textContent = '₹ —';
      var hint = 'Enter your daily revenue to see your estimate';
      if (daily > 0 && !daysOk)   hint = 'Enter days per week (1–7) to see your estimate';
      if (daily > 0 && !monthsOk) hint = 'Enter active months per year (1–12) to see your estimate';
      document.getElementById('turnoverLabel').textContent  = hint;
      document.getElementById('tierBadge').style.display    = 'none';
      document.getElementById('tempPanel').style.display    = 'none';
      document.getElementById('tiersGlance').style.display  = 'none';
      currentTier     = null;
      currentTurnover = 0;
      return;
    }

    var turnover = calcTurnover(daily, dwRaw, myRaw);
    var tier     = getTier(turnover);
    var panIndia = document.getElementById('panIndiaCheck');
    if (panIndia && panIndia.checked) tier = 'central';
    currentTier     = tier;
    currentTurnover = turnover;

    document.getElementById('turnoverAmount').textContent = formatINR(turnover);
    document.getElementById('turnoverLabel').textContent  = 'estimated annual turnover';

    var badge = document.getElementById('tierBadge');
    badge.className   = 'reg-tier-badge ' + TIER_BADGE_CLASS[tier];
    badge.textContent = TIER_LABELS[tier];
    badge.style.display = 'inline-block';

    document.getElementById('tempPanel').style.display   = (tier === 'temporary-basic') ? '' : 'none';
    document.getElementById('tiersGlance').style.display = (tier !== 'temporary-basic') ? '' : 'none';

    ['tier-basic', 'tier-state-basic', 'tier-state', 'tier-central'].forEach(function (id) {
      var row = document.getElementById(id);
      if (row) row.classList.remove('active-tier');
    });

    var activeId = TIER_ROW_IDS[tier];
    var activeRow = document.getElementById(activeId);
    if (activeRow) activeRow.classList.add('active-tier');
  }

  function saveAndContinue() {
    if (!currentTier) {
      document.getElementById('scaleError').textContent = 'Please enter your daily revenue to continue.';
      return;
    }
    document.getElementById('scaleError').textContent = '';

    var user = firebase.auth().currentUser;
    if (!user) { window.location.href = '/'; return; }

    var btn = document.getElementById('scaleContinueBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    var panIndia = document.getElementById('panIndiaCheck').checked;
    var months   = Math.min(12, Math.max(1, parseInt(document.getElementById('monthsPerYear').value) || 1));
    var daily    = parseFloat(document.getElementById('dailyRevenue').value) || 0;
    var days     = getDaysPerWeek();

    firebase.firestore().collection('users').doc(user.uid).set({
      scale: {
        dailyRevenue:  daily,
        daysPerWeek:   days,
        monthsPerYear: months,
        turnover:      currentTurnover,
        tier:          currentTier,
        fee:           TIER_FEES[currentTier],
        panIndia:      panIndia
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    .then(function () {
      var dest = btn.dataset.fromReview === 'true' ? '/review' : '/business-details';
      window.location.href = dest;
    })
    .catch(function (e) {
      console.error('[FOSCOS] Firestore save scale:', e);
      document.getElementById('scaleError').textContent = 'Could not save. Please try again.';
      btn.disabled    = false;
      btn.textContent = 'Let\'s proceed with the license →';
    });
  }

  function loadExisting() {
    var user = firebase.auth().currentUser;
    if (!user) return;
    firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
      if (!doc.exists) return;
      var s = doc.data().scale;
      if (!s) return;
      var dr = document.getElementById('dailyRevenue');
      var my = document.getElementById('monthsPerYear');
      var dw = document.getElementById('daysPerWeekInput');
      var pi = document.getElementById('panIndiaCheck');
      if (dr) dr.value = s.dailyRevenue || '';
      if (my) my.value = s.monthsPerYear || '';
      if (dw) dw.value = s.daysPerWeek || '';
      if (pi) pi.checked = s.panIndia || false;
      updateResult();
    });
  }

  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }
      loadExisting();
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    var dr = document.getElementById('dailyRevenue');
    var my = document.getElementById('monthsPerYear');
    var dw = document.getElementById('daysPerWeekInput');
    var pi = document.getElementById('panIndiaCheck');
    if (dr) dr.addEventListener('input', updateResult);
    if (my) {
      my.addEventListener('input', updateResult);
      my.addEventListener('blur', function () {
        var v = parseInt(my.value);
        if (!isNaN(v)) { if (v < 1) my.value = 1; if (v > 12) my.value = 12; }
        updateResult();
      });
    }
    if (dw) {
      dw.addEventListener('input', updateResult);
      dw.addEventListener('blur', function () {
        var v = parseInt(dw.value);
        if (!isNaN(v)) { if (v < 1) dw.value = 1; if (v > 7) dw.value = 7; }
        updateResult();
      });
    }
    if (pi) pi.addEventListener('change', updateResult);

    var btn = document.getElementById('scaleContinueBtn');
    if (btn) btn.addEventListener('click', saveAndContinue);

    var tempBtn = document.getElementById('btnTempLicense');
    if (tempBtn) tempBtn.addEventListener('click', function () { window.location.href = '/temp-license'; });

    var learnBtn = document.getElementById('btnTempLearnMore');
    if (learnBtn) learnBtn.addEventListener('click', function () { window.location.href = '/temp-license'; });

    var params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'review') {
      var cb = document.getElementById('scaleContinueBtn');
      if (cb) {
        cb.textContent        = 'Save & Back to Review →';
        cb.dataset.fromReview = 'true';
      }
    }
  });

})();
