/* ============================================================
   ONE_STOP_SHOP.JS
   ============================================================ */
(function () {
  'use strict';

  var isLoggedIn = false;
  var cartItems  = [];  // [{ id, name, price, qty, type }]
  var fromDocuments = (new URLSearchParams(window.location.search).get('from') === 'documents');

  // ── Booking modal state ───────────────────────────────────────
  var bookingState = {
    type:        null,   // 'water' | 'medical'
    serviceId:   null,
    serviceName: null,
    priceEach:   0,
    qty:         1,
    date:        null,
    time:        null
  };

  // ── Helpers ───────────────────────────────────────────────────
  function fmt(n) { return 'Rs. ' + Number(n).toLocaleString('en-IN'); }
  function fmtRupee(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val || '');
  }

  function show(id) { var el = document.getElementById(id); if (el) el.style.display = ''; }
  function hide(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

  // ── Tab activation helper ─────────────────────────────────────
  function activateTab(name) {
    document.querySelectorAll('.oss-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.oss-panel').forEach(function (p) { p.classList.remove('active'); });
    var tab = document.querySelector('.oss-tab[data-tab="' + name + '"]');
    if (tab) tab.classList.add('active');
    var panel = document.getElementById('panel' + capitalize(name));
    if (panel) panel.classList.add('active');
  }

  // ── Header: Skip / Continue buttons + reg-flow nav ──────────
  function initHeader() {
    var actions = document.getElementById('ossHeaderActions');
    var navRow  = document.getElementById('ossNavRow');

    if (fromDocuments) {
      if (actions) {
        actions.innerHTML =
          '<a href="/review" class="oss-skip-btn">Skip for now</a>' +
          '<a href="/review" class="oss-continue-btn" id="ossContinueBtn">Continue to Review →</a>';
      }

      var regNav = document.getElementById('ossRegNav');
      if (regNav) {
        regNav.style.display = '';
        var page = document.getElementById('ossPage');
        if (page) page.classList.add('oss-page--reg-flow');
      }

      if (navRow) navRow.style.display = '';
    } else {
      if (navRow) {
        navRow.innerHTML =
          '<a href="/fbo-portal" class="oss-page-header__back-link">← Back to Dashboard</a>' +
          '<a href="/" class="oss-page-header__home-link">🏠 Home</a>';
        navRow.style.display = '';
      }
    }
  }

  // ── Auth banner ───────────────────────────────────────────────
  function setAuthState(loggedIn) {
    isLoggedIn = loggedIn;
    var banner = document.getElementById('ossAuthBanner');
    if (banner) banner.style.display = loggedIn ? 'none' : 'flex';

    document.querySelectorAll('.oss-book-btn, .oss-add-to-cart-btn, .oss-plan-btn').forEach(function (btn) {
      btn.disabled = !loggedIn;
      if (!loggedIn) btn.title = 'Sign in to use this feature';
    });
  }

  // ── Main tabs ─────────────────────────────────────────────────
  function initTabs() {
    document.querySelectorAll('.oss-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        document.querySelectorAll('.oss-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.oss-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('panel' + capitalize(target));
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ── Manual vertical tabs ──────────────────────────────────────
  function initManualTabs() {
    document.querySelectorAll('.oss-manual-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var mod = tab.getAttribute('data-module');
        document.querySelectorAll('.oss-manual-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.oss-module').forEach(function (m) { m.classList.remove('active'); });
        tab.classList.add('active');
        var mod_el = document.getElementById('module' + capitalize(mod));
        if (mod_el) mod_el.classList.add('active');
      });
    });

    // Video guide buttons — placeholder alert
    document.querySelectorAll('.oss-video-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        alert('Video guides coming soon. Use the Download PDF button to access offline instructions.');
      });
    });

    // Download PDF — placeholder
    var dlBtn = document.getElementById('manualDownloadBtn');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        alert('PDF download coming soon. The manual will be available for offline kitchen use.');
      });
    }
  }

  // ── Fire checklist progress ───────────────────────────────────
  function initFireChecklist() {
    var total = 7;
    document.querySelectorAll('.fire-check').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var done = document.querySelectorAll('.fire-check:checked').length;
        var pct  = Math.round((done / total) * 100);
        var bar  = document.getElementById('fireProgressBar');
        var lbl  = document.getElementById('fireProgressLabel');
        if (bar) bar.style.width = pct + '%';
        if (lbl) lbl.textContent = done + ' of ' + total + ' items checked';
      });
    });
  }

  // ── Booking modal ─────────────────────────────────────────────
  function initBookingModal() {
    var overlay = document.getElementById('ossBookingOverlay');

    document.querySelectorAll('.oss-book-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!isLoggedIn) { openLoginModal(); return; }

        bookingState.type        = btn.getAttribute('data-book-type');
        bookingState.serviceId   = btn.getAttribute('data-service-id');
        bookingState.serviceName = btn.getAttribute('data-service-name');
        bookingState.priceEach   = parseInt(btn.getAttribute('data-price'), 10) || 0;
        bookingState.qty         = 1;
        bookingState.date        = null;
        bookingState.time        = null;

        openBookingModal();
      });
    });

    // Time slot selection
    document.querySelectorAll('.oss-time-slot').forEach(function (slot) {
      slot.addEventListener('click', function () {
        document.querySelectorAll('.oss-time-slot').forEach(function (s) { s.classList.remove('selected'); });
        slot.classList.add('selected');
        bookingState.time = slot.getAttribute('data-time');
        updateBookingTotal();
      });
    });

    // Staff quantity
    document.getElementById('ossQtyMinus').addEventListener('click', function () {
      if (bookingState.qty > 1) { bookingState.qty--; updateQtyDisplay(); updateBookingTotal(); }
    });
    document.getElementById('ossQtyPlus').addEventListener('click', function () {
      if (bookingState.qty < 20) { bookingState.qty++; updateQtyDisplay(); updateBookingTotal(); }
    });

    // Date change
    document.getElementById('ossBookingDate').addEventListener('change', function () {
      bookingState.date = this.value;
    });

    // Confirm
    document.getElementById('ossBookingConfirm').addEventListener('click', confirmBooking);

    // Close
    document.getElementById('ossBookingClose').addEventListener('click', closeBookingModal);
    document.getElementById('ossBookingDone').addEventListener('click', closeBookingModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeBookingModal(); });
  }

  function openBookingModal() {
    var isMedical = bookingState.type === 'medical';

    document.getElementById('ossBookingForm').style.display  = '';
    document.getElementById('ossBookingSuccess').style.display = 'none';

    setText('ossBookingTitle', 'Book: ' + bookingState.serviceName);
    setText('ossBookingSub', isMedical
      ? 'Select a date, time, and number of staff for the health check appointment.'
      : 'Select a preferred date and time for the site water testing visit.');

    var staffField = document.getElementById('ossStaffField');
    staffField.style.display = isMedical ? '' : 'none';

    bookingState.qty = 1;
    updateQtyDisplay();

    // Set price per person hint
    var hint = document.getElementById('ossQtyHint');
    if (hint) hint.textContent = fmtRupee(bookingState.priceEach) + ' per person';

    // Reset slots and date
    document.querySelectorAll('.oss-time-slot').forEach(function (s) { s.classList.remove('selected'); });
    document.getElementById('ossBookingDate').value = '';
    bookingState.time = null; bookingState.date = null;

    setText('ossBookingError', '');
    updateBookingTotal();

    // Set min date to tomorrow
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('ossBookingDate').min = tomorrow.toISOString().split('T')[0];

    document.getElementById('ossBookingOverlay').classList.add('open');
  }

  function closeBookingModal() {
    document.getElementById('ossBookingOverlay').classList.remove('open');
  }

  function updateQtyDisplay() {
    setText('ossQtyVal', bookingState.qty);
  }

  function updateBookingTotal() {
    var total = bookingState.priceEach * bookingState.qty;
    setText('ossBookingTotal', fmtRupee(total));
  }

  function confirmBooking() {
    setText('ossBookingError', '');
    if (!bookingState.date) { setText('ossBookingError', 'Please select a date.'); return; }
    if (!bookingState.time) { setText('ossBookingError', 'Please select a time slot.'); return; }

    var total     = bookingState.priceEach * bookingState.qty;
    var itemId    = bookingState.type + '-' + bookingState.serviceId;
    var itemName  = bookingState.serviceName;
    if (bookingState.type === 'medical') itemName += ' (' + bookingState.qty + ' staff)';

    addToCart({
      id:    itemId,
      name:  itemName,
      price: total,
      qty:   1,
      type:  'booking',
      date:  bookingState.date,
      time:  bookingState.time
    });

    // Show success
    document.getElementById('ossBookingForm').style.display    = 'none';
    document.getElementById('ossBookingSuccess').style.display = '';

    var dateStr = new Date(bookingState.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    var msg = bookingState.serviceName + ' on ' + dateStr + ' at ' + bookingState.time + '. ';
    if (bookingState.type === 'water') {
      msg += 'The lab will contact you to confirm the visit. Your water test report will be filed directly to your application.';
    } else {
      msg += 'The clinic will send a confirmation. Bring valid ID for all staff on the day.';
    }
    setText('ossBookingSuccessMsg', msg);
  }

  // ── Kit: Add to cart ──────────────────────────────────────────
  function initKit() {
    var btn = document.getElementById('kitAddToCartBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      if (!isLoggedIn) { openLoginModal(); return; }

      var already = cartItems.find(function (i) { return i.id === 'fssai-safety-kit'; });
      if (already) { show('kitInCartNote'); return; }

      addToCart({ id: 'fssai-safety-kit', name: 'FSSAI Routine Safety Kit', price: 3500, qty: 1, type: 'product' });
      btn.disabled = true;
      btn.textContent = 'Added to Cart ✓';
      show('kitInCartNote');
    });
  }

  // ── Hygiene subscription modal ────────────────────────────────
  function initHygieneModal() {
    var overlay = document.getElementById('ossHygieneOverlay');

    document.querySelectorAll('.oss-plan-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!isLoggedIn) { openLoginModal(); return; }

        var plan     = btn.getAttribute('data-plan');
        var planName = btn.getAttribute('data-plan-name');
        var price    = parseInt(btn.getAttribute('data-price'), 10);

        setText('ossHygieneTitle', 'Subscribe: ' + planName);
        setText('ossHygieneSub',
          plan === 'monthly'
            ? 'Monthly recurring subscription. You can cancel at any time from your FBO dashboard.'
            : 'Annual subscription at a discounted rate. Includes all monthly benefits plus priority scheduling.');
        setText('ossHygieneTotal', fmtRupee(price));
        setText('ossHygieneError', '');

        var featureEl = document.getElementById('ossHygieneFeatures');
        if (featureEl) {
          var features = plan === 'monthly'
            ? ['Monthly hygiene audit visit', 'Verified Hygiene Badge', 'Written inspection report', 'FSSAI inspection alert', 'Cancel anytime']
            : ['Monthly hygiene audit visits (12/year)', 'Verified Hygiene Badge (framed)', 'Written inspection reports', 'FSSAI inspection alert', 'Priority scheduling', 'Export audit history', '2 free re-inspections'];
          featureEl.innerHTML = features.map(function (f) { return '<li>✓ ' + f + '</li>'; }).join('');
        }

        document.getElementById('ossHygieneForm').style.display    = '';
        document.getElementById('ossHygieneSuccess').style.display = 'none';
        overlay.classList.add('open');

        document.getElementById('ossHygieneConfirm').onclick = function () {
          var already = cartItems.find(function (i) { return i.type === 'subscription'; });
          if (already) {
            setText('ossHygieneError', 'A hygiene subscription is already in your cart.');
            return;
          }
          addToCart({ id: 'hygiene-' + plan, name: planName, price: price, qty: 1, type: 'subscription' });
          document.getElementById('ossHygieneForm').style.display    = 'none';
          document.getElementById('ossHygieneSuccess').style.display = '';
        };
      });
    });

    document.getElementById('ossHygieneClose').addEventListener('click', closeHygieneModal);
    document.getElementById('ossHygieneDone').addEventListener('click', closeHygieneModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeHygieneModal(); });
  }

  function closeHygieneModal() {
    document.getElementById('ossHygieneOverlay').classList.remove('open');
  }

  // ── Cart management ───────────────────────────────────────────
  function addToCart(item) {
    var existing = cartItems.findIndex(function (i) { return i.id === item.id; });
    if (existing !== -1) {
      cartItems[existing] = item;
    } else {
      cartItems.push(item);
    }
    saveCart();
    updateCartBar();
  }

  function removeFromCart(itemId) {
    cartItems = cartItems.filter(function (i) { return i.id !== itemId; });
    // If kit was removed, re-enable the Add to Cart button
    if (itemId === 'fssai-safety-kit') {
      var btn = document.getElementById('kitAddToCartBtn');
      if (btn) { btn.disabled = false; btn.textContent = 'Add to Cart →'; }
      hide('kitInCartNote');
    }
    saveCart();
    updateCartBar();
  }

  function updateCartBar() {
    var bar   = document.getElementById('ossCartBar');
    var items = document.getElementById('ossCartItems');
    var total = document.getElementById('ossCartTotal');
    if (!bar) return;

    if (!cartItems.length) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = '';

    var sum = cartItems.reduce(function (acc, i) { return acc + i.price; }, 0);
    if (total) total.textContent = fmtRupee(sum);

    if (items) {
      items.innerHTML = cartItems.map(function (item) {
        return '<div class="oss-cart-chip">' +
          '<span class="oss-cart-chip__name">' + escHtml(truncate(item.name, 28)) + '</span>' +
          '<span class="oss-cart-chip__price">' + fmtRupee(item.price) + '</span>' +
          '<button class="oss-cart-chip__remove" data-id="' + escHtml(item.id) + '" title="Remove">&times;</button>' +
          '</div>';
      }).join('');

      items.querySelectorAll('.oss-cart-chip__remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          removeFromCart(btn.getAttribute('data-id'));
        });
      });
    }

    // Sync kit button state
    var kitInCart = cartItems.find(function (i) { return i.id === 'fssai-safety-kit'; });
    var kitBtn    = document.getElementById('kitAddToCartBtn');
    var kitNote   = document.getElementById('kitInCartNote');
    if (kitBtn && kitInCart) {
      kitBtn.disabled    = true;
      kitBtn.textContent = 'Added to Cart ✓';
      if (kitNote) kitNote.style.display = '';
    }
  }

  function loadCart() {
    var user = firebase.auth().currentUser;
    if (!user) return;
    firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
      var d = doc.exists ? doc.data() : {};
      if (d.ossCart && Array.isArray(d.ossCart.items)) {
        cartItems = d.ossCart.items;
        updateCartBar();
      }
    }).catch(function (e) { console.error('[FOSCOS] OSS load cart:', e); });
  }

  function saveCart() {
    var user = firebase.auth().currentUser;
    if (!user) return;
    var sum = cartItems.reduce(function (acc, i) { return acc + i.price; }, 0);
    firebase.firestore().collection('users').doc(user.uid).set({
      ossCart:   { items: cartItems, total: sum },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function (e) { console.error('[FOSCOS] OSS save cart:', e); });
  }

  // ── FOSTAC tab buttons ────────────────────────────────────────
  function initFostac() {
    var enrolBtn = document.getElementById('ossEnrolFostacBtn');
    if (enrolBtn) {
      enrolBtn.addEventListener('click', function () {
        enrolBtn.disabled    = true;
        enrolBtn.textContent = 'Submitting…';
        setTimeout(function () {
          enrolBtn.style.display = 'none';
          var success = document.getElementById('ossEnrolFostacSuccess');
          if (success) success.style.display = '';
        }, 800);
      });
    }

    var certInput = document.getElementById('ossFostacCertInput');
    if (certInput) {
      certInput.addEventListener('change', function () {
        var file = certInput.files[0];
        if (!file) return;
        var success = document.getElementById('ossFostacUploadSuccess');
        if (success) success.style.display = '';
      });
    }
  }

  // ── Review & Pay button ───────────────────────────────────────
  function initReviewPayBtn() {
    var btn = document.getElementById('ossReviewPayBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.location.href = '/review';
    });
  }

  // ── Utilities ─────────────────────────────────────────────────
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Init ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    initHeader();
    initTabs();
    initManualTabs();
    initFireChecklist();
    initBookingModal();
    initKit();
    initHygieneModal();
    initFostac();
    initReviewPayBtn();
  });

  document.addEventListener('firebase-ready', function () {
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        setAuthState(true);
        loadCart();
        firebase.firestore().collection('users').doc(user.uid).get().then(function (doc) {
          var d = doc.exists ? doc.data() : {};
          if (d.documents && d.documents.waterTestReport) {
            activateTab('medical');
          }
        }).catch(function () {});
      } else {
        setAuthState(false);
      }
    });
  });

})();
