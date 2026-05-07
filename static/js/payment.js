/* ============================================================
   PAYMENT.JS — P12 Mock payment → generate application ID → P13
   ============================================================ */
(function () {
  'use strict';

  var TIER_LABELS = {
    'temporary-basic': 'Basic Registration',
    'basic':           'State License (Basic)',
    'state':           'State License',
    'central':         'Central License'
  };

  function generateAppId() {
    var year = new Date().getFullYear();
    var rand = String(Math.floor(10000 + Math.random() * 90000));
    return 'FSSAI-' + year + '-' + rand;
  }

  function populateSummary(d) {
    var rows  = document.getElementById('paymentSummaryRows');
    var total = document.getElementById('payTotalAmount');
    if (!rows || !d) return;

    var tier     = (d.scale && d.scale.tier) || 'basic';
    var fee      = (d.scale && d.scale.fee)  || 0;
    var years    = (d.review && d.review.years) || 1;
    var licenseFee = (d.review && d.review.totalFee) || fee * years;

    rows.innerHTML =
      row('License Type', TIER_LABELS[tier] || tier) +
      row('Duration', years + (years === 1 ? ' Year' : ' Years')) +
      row('Annual Fee', '₹' + fee.toLocaleString('en-IN'));

    // OSS add-ons
    var ossTotal    = 0;
    var addonRows   = document.getElementById('paymentAddonRows');
    var addonSec    = document.getElementById('paymentAddonsSection');
    var ossCart     = d.ossCart;

    if (ossCart && ossCart.items && ossCart.items.length && addonRows && addonSec) {
      addonSec.style.display = '';
      addonRows.innerHTML = ossCart.items.map(function (item) {
        ossTotal += item.price || 0;
        return row(item.name, '₹' + (item.price || 0).toLocaleString('en-IN'));
      }).join('');
    }

    var grandTotal = licenseFee + ossTotal;
    if (total) total.textContent = '₹' + grandTotal.toLocaleString('en-IN');
  }

  function row(label, value) {
    return '<div class="payment-summary-row"><span>' + label + '</span><span>' + value + '</span></div>';
  }

  function activateStep(n) {
    var el = document.getElementById('pstep' + n);
    if (el) el.classList.add('active');
  }

  function completeStep(n) {
    var el = document.getElementById('pstep' + n);
    if (el) { el.classList.remove('active'); el.classList.add('done'); }
  }

  function mockPay(user, userData) {
    var payMethodEl = document.querySelector('input[name="payMethod"]:checked');
    var payMethod   = payMethodEl ? payMethodEl.value : 'upi';

    document.getElementById('paymentDefault').style.display    = 'none';
    document.getElementById('paymentProcessing').style.display = 'flex';

    activateStep(1);

    setTimeout(function () {
      completeStep(1); activateStep(2);
      setTimeout(function () {
        completeStep(2); activateStep(3);
        setTimeout(function () {
          completeStep(3); activateStep(4);

          var appId = generateAppId();
          var db    = firebase.firestore();
          var ts    = firebase.firestore.FieldValue.serverTimestamp();

          var tier  = (userData.scale && userData.scale.tier) || 'basic';
          var fee   = (userData.scale && userData.scale.fee)  || 0;
          var years = (userData.review && userData.review.years) || 1;

          var appDoc = {
            appId:             appId,
            uid:               user.uid,
            phone:             user.phoneNumber || userData.phone || '',
            displayName:       user.displayName || '',
            businessTypes:     userData.businessTypes     || [],
            foodTypes:         userData.foodTypes         || [],
            scale:             userData.scale             || {},
            details:           userData.details           || {},
            documents:         userData.documents         || {},
            ossCart:           userData.ossCart           || {},
            tier:              tier,
            fee:               fee,
            years:             years,
            paymentMethod:     payMethod,
            applicationStatus: 'submitted',
            submittedAt:       ts,
            updatedAt:         ts,
            auditTrail: [{
              action:    'Application submitted',
              by:        'citizen',
              timestamp: new Date().toISOString()
            }]
          };

          var batch = db.batch();
          batch.set(db.collection('applications').doc(appId), appDoc);
          batch.set(db.collection('users').doc(user.uid), {
            applicationId:     appId,
            applicationStatus: 'submitted',
            submittedAt:       ts,
            updatedAt:         ts
          }, { merge: true });

          batch.commit()
          .then(function () {
            completeStep(4);
            setTimeout(function () {
              window.location.href = '/application-submitted';
            }, 600);
          })
          .catch(function (e) {
            console.error('[FOSCOS] payment finalise:', e);
            document.getElementById('paymentProcessing').style.display = 'none';
            document.getElementById('paymentDefault').style.display    = '';
            document.getElementById('payError').textContent            = 'Something went wrong. Please try again.';
          });
        }, 900);
      }, 900);
    }, 900);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.payment-method-row input[type="radio"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        document.querySelectorAll('.payment-method-row').forEach(function (row) {
          row.classList.remove('selected');
        });
        radio.closest('.payment-method-row').classList.add('selected');
      });
    });
  });

  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/'; return; }

      firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
        var d = doc.exists ? doc.data() : {};

        // If already submitted, go straight to portal
        var PORTAL_STATUSES = ['submitted','pending','approved','documents_requested',
          'inspection_scheduled','inspection_complete','final_review'];
        if (PORTAL_STATUSES.indexOf(d.applicationStatus) !== -1) {
          window.location.href = '/fbo-portal'; return;
        }

        populateSummary(d);

        var btn = document.getElementById('payNowBtn');
        if (btn) {
          btn.addEventListener('click', function () {
            btn.disabled = true;
            mockPay(user, d);
          });
        }
      });
    });
  });

})();
