#!/usr/bin/env python3
"""
seed.py — Seeds 10 approved restaurant applications into Firestore.

Writes to TWO collections per restaurant so both portals work correctly:
  applications/{appId}  — read by the officer portal
  users/{uid}           — read by the FBO portal (approved-state dashboard)

Usage:
  1. Firebase Console → Project Settings → Service Accounts
     → Generate new private key → save as serviceAccountKey.json in this folder
  2. pip install firebase-admin
  3. python seed.py

Running this script twice is safe — it uses .set() with fixed document IDs
so each run overwrites with identical data (idempotent).
"""

import sys
import os
from datetime import datetime, timezone

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, auth
except ImportError:
    print("ERROR: firebase-admin is not installed.")
    print("       Run:  pip install firebase-admin")
    sys.exit(1)

KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json')
if not os.path.exists(KEY_FILE):
    print("ERROR: serviceAccountKey.json not found in the project root.")
    print("       Firebase Console → Project Settings → Service Accounts")
    print("       → Generate new private key → save as serviceAccountKey.json")
    sys.exit(1)

cred = credentials.Certificate(KEY_FILE)
firebase_admin.initialize_app(cred)
db = firestore.client()


# ── Auth user creation ────────────────────────────────────────────────────────

AUTH_USERS = [
    ('seed_uid_001', '9863010001', "Dylan's Cafe Owner"),
    ('seed_uid_002', '9863010002', 'City Hut Owner'),
    ('seed_uid_003', '9863010003', 'Trattoria Owner'),
    ('seed_uid_004', '9863010004', 'Lamee Restaurant Owner'),
    ('seed_uid_005', '9863010005', 'Cafe Shillong Owner'),
    ('seed_uid_006', '9863010006', 'ML 05 Cafe Owner'),
    ('seed_uid_007', '9863010007', 'The Wok Owner'),
    ('seed_uid_008', '9863010008', 'Jadoh House Owner'),
    ('seed_uid_009', '9863010009', 'Bread Cafe Owner'),
    ('seed_uid_010', '9863010010', 'Cafe 17 Owner'),
    ('seed_uid_011', '9863010011', "Priya's Kitchen Owner"),
]


def create_auth_users():
    print("Creating Firebase Auth users (email/password — no SMS required)...\n")
    for uid, phone, display_name in AUTH_USERS:
        # Email derived from phone so auth.js can look it up deterministically.
        email = f'demo+91{phone}@foscos.local'
        try:
            auth.create_user(
                uid=uid,
                email=email,
                email_verified=True,
                password='123456',
                display_name=display_name,
            )
            print(f"  Created  {uid}  {email}")
        except auth.UidAlreadyExistsError:
            try:
                auth.update_user(uid, email=email, email_verified=True, password='123456')
                print(f"  Updated  {uid}  {email}  (added email/password to existing user)")
            except Exception as ue:
                print(f"  Update failed  {uid}  — {ue}")
        except auth.EmailAlreadyExistsError:
            print(f"  Email exists  {email}  (skipped)")
        except Exception as e:
            print(f"  ERROR    {uid}  {email}  — {e}")
    print()


# ── Helpers ───────────────────────────────────────────────────────────────────

def dt(year, month, day, hour=10, minute=0):
    """UTC-aware datetime for use as a Firestore Timestamp."""
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def audit(action, by, status_key=None, note=None, when=None):
    entry = {
        'action':    action,
        'by':        by,
        'timestamp': (when or datetime.now(timezone.utc)).isoformat(),
    }
    if status_key:
        entry['statusKey'] = status_key
    if note:
        entry['note'] = note
    return entry


def grievance(gid, gtype, description, status, raised, resolved=None, resolved_by=None):
    return {
        'id':          gid,
        'type':        gtype,
        'description': description,
        'status':      status,
        'raisedAt':    raised.isoformat(),
        'resolvedAt':  resolved.isoformat() if resolved else None,
        'resolvedBy':  resolved_by,
    }


# ── Restaurant data ───────────────────────────────────────────────────────────
#
# All 10 restaurants are in Shillong, Meghalaya.
# Tier thresholds (from scale.js):
#   basic  — turnover ₹10 L – ₹1.5 Cr  — fee ₹100 / year
#   state  — turnover ₹1.5 Cr – ₹20 Cr — fee ₹2,000 / year
# Turnover formula (from scale.js): daily × daysPerWeek × 4.3 × monthsPerYear

RESTAURANTS = [

    # ── 1. Dylan's Cafe ───────────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10001',
        'uid':         'seed_uid_001',
        'phone':       '9863010001',
        'displayName': 'Dylan Lyngdoh',

        'businessTypes': ['restaurant-cafe'],
        'foodTypes':     ['beverages', 'confectionery', 'ready-to-eat'],

        'scale': {
            'dailyRevenue':  55000,
            'daysPerWeek':   7,
            'monthsPerYear': 12,
            'turnover':      19833000,   # 55000 × 7 × 4.3 × 12
            'tier':          'state',
            'fee':           2000,
            'panIndia':      False,
        },
        'details': {
            'bizName':      "Dylan's Cafe",
            'ownerName':    'Dylan Lyngdoh',
            'bizPhone':     '9863010001',
            'addrLine1':    'GNB Road, Police Bazaar',
            'addrLine2':    '',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793001',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
            'form9': True, 'blueprint': True, 'waterTestReport': True,
        },
        'ossCart': {
            'items': [
                {'id': 'water-test', 'name': 'Water Analysis Report', 'price': 999, 'qty': 1, 'type': 'lab'},
            ],
            'total': 999,
        },

        'tier':          'state',
        'fee':           2000,
        'years':         3,
        'paymentMethod': 'upi',

        'applicationStatus': 'approved',
        'fssaiRating':       4.5,
        'grievances':        [],

        'submittedAt': dt(2026, 1, 10),
        'updatedAt':   dt(2026, 4, 15),
        'review': {'years': 3, 'totalFee': 6000},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2026, 1, 10)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  note='All documents verified. Scheduling site visit.',
                  when=dt(2026, 2, 3)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  note='Premises inspection passed. Kitchen layout compliant.',
                  when=dt(2026, 3, 1)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 3, 20)),
            audit('Application approved', 'officer',
                  'approved',
                  note='License issued. All standards met.',
                  when=dt(2026, 4, 15)),
        ],
    },

    # ── 2. City Hut Family Dhaba ──────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10002',
        'uid':         'seed_uid_002',
        'phone':       '9863010002',
        'displayName': 'Bhuvan Sharma',

        'businessTypes': ['dhaba'],
        'foodTypes':     ['ready-to-eat', 'cereals', 'dairy-analogues'],

        'scale': {
            'dailyRevenue':  65000,
            'daysPerWeek':   7,
            'monthsPerYear': 12,
            'turnover':      23439000,
            'tier':          'state',
            'fee':           2000,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'City Hut Family Dhaba',
            'ownerName':    'Bhuvan Sharma',
            'bizPhone':     '9863010002',
            'addrLine1':    'Laitumkhrah Main Road',
            'addrLine2':    'Near Laitumkhrah Market',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793003',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
            'form9': True, 'blueprint': True, 'waterTestReport': True,
        },
        'ossCart': {
            'items': [
                {'id': 'water-test',   'name': 'Water Analysis Report',   'price': 999, 'qty': 1, 'type': 'lab'},
                {'id': 'medical-cert', 'name': 'Medical Certificate (Staff)', 'price': 299, 'qty': 1, 'type': 'health'},
            ],
            'total': 1298,
        },

        'tier':          'state',
        'fee':           2000,
        'years':         5,
        'paymentMethod': 'netbanking',

        'applicationStatus': 'approved',
        'fssaiRating':       3.5,
        'grievances': [
            grievance(
                'GRV-2026-10002-01', 'hygiene',
                'Reported unhygienic storage of raw vegetables near preparation area.',
                'resolved',
                raised=dt(2026, 3, 20),
                resolved=dt(2026, 4, 5),
                resolved_by='Officer R. Dkhar',
            ),
        ],

        'submittedAt': dt(2026, 1, 5),
        'updatedAt':   dt(2026, 4, 28),
        'review': {'years': 5, 'totalFee': 10000},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2026, 1, 5)),
            audit('Additional documents requested', 'officer',
                  'documents_requested',
                  note='Please provide updated kitchen layout blueprint.',
                  when=dt(2026, 1, 25)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2026, 2, 15)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  when=dt(2026, 3, 10)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 4, 1)),
            audit('Application approved', 'officer',
                  'approved',
                  note='License issued.',
                  when=dt(2026, 4, 28)),
        ],
    },

    # ── 3. Trattoria ──────────────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10003',
        'uid':         'seed_uid_003',
        'phone':       '9863010003',
        'displayName': 'Priya Nonglait',

        'businessTypes': ['restaurant-cafe'],
        'foodTypes':     ['ready-to-eat', 'dairy-analogues', 'fats-oils', 'beverages'],

        'scale': {
            'dailyRevenue':  75000,
            'daysPerWeek':   7,
            'monthsPerYear': 11,
            'turnover':      24832500,   # 75000 × 7 × 4.3 × 11
            'tier':          'state',
            'fee':           2000,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'Trattoria',
            'ownerName':    'Priya Nonglait',
            'bizPhone':     '9863010003',
            'addrLine1':    'MG Road',
            'addrLine2':    'Opposite Pinewood Hotel',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793001',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
            'form9': True, 'blueprint': True, 'waterTestReport': True,
        },
        'ossCart': {
            'items': [
                {'id': 'water-test',   'name': 'Water Analysis Report',      'price': 999, 'qty': 1, 'type': 'lab'},
                {'id': 'hygiene-kit',  'name': 'FSSAI Hygiene Training Kit', 'price': 449, 'qty': 1, 'type': 'training'},
            ],
            'total': 1448,
        },

        'tier':          'state',
        'fee':           2000,
        'years':         3,
        'paymentMethod': 'card',

        'applicationStatus': 'approved',
        'fssaiRating':       4.0,
        'grievances':        [],

        'submittedAt': dt(2025, 11, 12),
        'updatedAt':   dt(2026, 2, 28),
        'review': {'years': 3, 'totalFee': 6000},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2025, 11, 12)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2025, 12, 5)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  note='Kitchen meets standards. Cold storage adequate.',
                  when=dt(2026, 1, 8)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 2, 1)),
            audit('Application approved', 'officer',
                  'approved',
                  when=dt(2026, 2, 28)),
        ],
    },

    # ── 4. Lamee Restaurant ───────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10004',
        'uid':         'seed_uid_004',
        'phone':       '9863010004',
        'displayName': 'Wei Khongwir',

        'businessTypes': ['restaurant-cafe'],
        'foodTypes':     ['ready-to-eat', 'meat-fish', 'cereals', 'beverages'],

        'scale': {
            'dailyRevenue':  80000,
            'daysPerWeek':   6,
            'monthsPerYear': 12,
            'turnover':      24768000,   # 80000 × 6 × 4.3 × 12
            'tier':          'state',
            'fee':           2000,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'Lamee Restaurant',
            'ownerName':    'Wei Khongwir',
            'bizPhone':     '9863010004',
            'addrLine1':    'Nongthymmai Road',
            'addrLine2':    '',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793014',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
            'form9': True, 'blueprint': True, 'waterTestReport': True,
        },
        'ossCart': {
            'items': [
                {'id': 'water-test', 'name': 'Water Analysis Report', 'price': 999, 'qty': 1, 'type': 'lab'},
            ],
            'total': 999,
        },

        'tier':          'state',
        'fee':           2000,
        'years':         3,
        'paymentMethod': 'upi',

        'applicationStatus': 'approved',
        'fssaiRating':       3.0,
        'grievances': [
            grievance(
                'GRV-2026-10004-01', 'food-quality',
                'Customer reported undercooked pork served at lunch service.',
                'resolved',
                raised=dt(2026, 3, 15),
                resolved=dt(2026, 4, 2),
                resolved_by='Officer B. Pariat',
            ),
        ],

        'submittedAt': dt(2025, 12, 1),
        'updatedAt':   dt(2026, 3, 20),
        'review': {'years': 3, 'totalFee': 6000},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2025, 12, 1)),
            audit('Additional documents requested', 'officer',
                  'documents_requested',
                  note='Food safety plan required for meat-handling operations.',
                  when=dt(2025, 12, 20)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2026, 1, 15)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  when=dt(2026, 2, 10)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 3, 1)),
            audit('Application approved', 'officer',
                  'approved',
                  note='License issued. HACCP plan accepted.',
                  when=dt(2026, 3, 20)),
        ],
    },

    # ── 5. Cafe Shillong ──────────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10005',
        'uid':         'seed_uid_005',
        'phone':       '9863010005',
        'displayName': 'Banriplun Lyngdoh',

        'businessTypes': ['restaurant-cafe', 'fixed-stall-kiosk'],
        'foodTypes':     ['beverages', 'confectionery'],

        'scale': {
            'dailyRevenue':  8000,
            'daysPerWeek':   7,
            'monthsPerYear': 12,
            'turnover':      2884800,    # 8000 × 7 × 4.3 × 12
            'tier':          'basic',
            'fee':           100,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'Cafe Shillong',
            'ownerName':    'Banriplun Lyngdoh',
            'bizPhone':     '9863010005',
            'addrLine1':    'Don Bosco Square',
            'addrLine2':    '',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793001',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
        },
        'ossCart': {'items': [], 'total': 0},

        'tier':          'basic',
        'fee':           100,
        'years':         1,
        'paymentMethod': 'upi',

        'applicationStatus': 'approved',
        'fssaiRating':       4.5,
        'grievances':        [],

        'submittedAt': dt(2026, 2, 10),
        'updatedAt':   dt(2026, 3, 25),
        'review': {'years': 1, 'totalFee': 100},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2026, 2, 10)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2026, 2, 25)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  when=dt(2026, 3, 10)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 3, 18)),
            audit('Application approved', 'officer',
                  'approved',
                  when=dt(2026, 3, 25)),
        ],
    },

    # ── 6. ML 05 Cafe ─────────────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10006',
        'uid':         'seed_uid_006',
        'phone':       '9863010006',
        'displayName': 'Dapher Mylliem',

        'businessTypes': ['restaurant-cafe'],
        'foodTypes':     ['beverages', 'ready-to-eat', 'confectionery'],

        'scale': {
            'dailyRevenue':  6000,
            'daysPerWeek':   6,
            'monthsPerYear': 12,
            'turnover':      1857600,    # 6000 × 6 × 4.3 × 12
            'tier':          'basic',
            'fee':           100,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'ML 05 Cafe',
            'ownerName':    'Dapher Mylliem',
            'bizPhone':     '9863010006',
            'addrLine1':    'Mawkhar',
            'addrLine2':    'Near Civil Hospital',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793002',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
        },
        'ossCart': {
            'items': [
                {'id': 'medical-cert', 'name': 'Medical Certificate (Staff)', 'price': 299, 'qty': 1, 'type': 'health'},
            ],
            'total': 299,
        },

        'tier':          'basic',
        'fee':           100,
        'years':         3,
        'paymentMethod': 'upi',

        'applicationStatus': 'approved',
        'fssaiRating':       3.5,
        'grievances': [
            grievance(
                'GRV-2026-10006-01', 'mislabelling',
                'Product label did not list allergen information as required by FSS regulations.',
                'resolved',
                raised=dt(2026, 4, 10),
                resolved=dt(2026, 4, 22),
                resolved_by='Officer R. Dkhar',
            ),
        ],

        'submittedAt': dt(2026, 1, 20),
        'updatedAt':   dt(2026, 4, 1),
        'review': {'years': 3, 'totalFee': 300},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2026, 1, 20)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2026, 2, 10)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  when=dt(2026, 3, 1)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 3, 20)),
            audit('Application approved', 'officer',
                  'approved',
                  when=dt(2026, 4, 1)),
        ],
    },

    # ── 7. The Wok ────────────────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10007',
        'uid':         'seed_uid_007',
        'phone':       '9863010007',
        'displayName': 'Kenny Saibon',

        'businessTypes': ['restaurant-cafe'],
        'foodTypes':     ['ready-to-eat', 'meat-fish', 'fruits-vegetables', 'beverages'],

        'scale': {
            'dailyRevenue':  90000,
            'daysPerWeek':   7,
            'monthsPerYear': 12,
            'turnover':      32454000,   # 90000 × 7 × 4.3 × 12
            'tier':          'state',
            'fee':           2000,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'The Wok',
            'ownerName':    'Kenny Saibon',
            'bizPhone':     '9863010007',
            'addrLine1':    'Jail Road',
            'addrLine2':    '',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793001',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
            'form9': True, 'blueprint': True, 'waterTestReport': True,
        },
        'ossCart': {
            'items': [
                {'id': 'water-test', 'name': 'Water Analysis Report', 'price': 999, 'qty': 1, 'type': 'lab'},
            ],
            'total': 999,
        },

        'tier':          'state',
        'fee':           2000,
        'years':         5,
        'paymentMethod': 'netbanking',

        'applicationStatus': 'approved',
        'fssaiRating':       4.0,
        'grievances':        [],

        'submittedAt': dt(2025, 10, 5),
        'updatedAt':   dt(2026, 1, 15),
        'review': {'years': 5, 'totalFee': 10000},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2025, 10, 5)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2025, 11, 1)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  note='Full kitchen inspection done. Fire safety compliant.',
                  when=dt(2025, 11, 28)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2025, 12, 15)),
            audit('Application approved', 'officer',
                  'approved',
                  when=dt(2026, 1, 15)),
        ],
    },

    # ── 8. Jadoh House ────────────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10008',
        'uid':         'seed_uid_008',
        'phone':       '9863010008',
        'displayName': 'Pynhunlang Nongkynmaw',

        'businessTypes': ['dhaba', 'fixed-stall-kiosk'],
        'foodTypes':     ['ready-to-eat', 'cereals', 'meat-fish'],

        'scale': {
            'dailyRevenue':  12000,
            'daysPerWeek':   7,
            'monthsPerYear': 12,
            'turnover':      4327200,    # 12000 × 7 × 4.3 × 12
            'tier':          'basic',
            'fee':           100,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'Jadoh House',
            'ownerName':    'Pynhunlang Nongkynmaw',
            'bizPhone':     '9863010008',
            'addrLine1':    'Iewduh, Bara Bazaar',
            'addrLine2':    '',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793002',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
        },
        'ossCart': {'items': [], 'total': 0},

        'tier':          'basic',
        'fee':           100,
        'years':         1,
        'paymentMethod': 'upi',

        'applicationStatus': 'approved',
        'fssaiRating':       5.0,
        'grievances':        [],

        'submittedAt': dt(2026, 3, 1),
        'updatedAt':   dt(2026, 5, 1),
        'review': {'years': 1, 'totalFee': 100},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2026, 3, 1)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2026, 3, 20)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  note='Exemplary hygiene standards observed.',
                  when=dt(2026, 4, 8)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 4, 20)),
            audit('Application approved', 'officer',
                  'approved',
                  note='Outstanding compliance. 5-star rating recommended.',
                  when=dt(2026, 5, 1)),
        ],
    },

    # ── 9. Bread Cafe ─────────────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10009',
        'uid':         'seed_uid_009',
        'phone':       '9863010009',
        'displayName': 'Anastasia War',

        'businessTypes': ['restaurant-cafe', 'food-manufacturer'],
        'foodTypes':     ['confectionery', 'cereals', 'dairy-analogues', 'beverages'],

        'scale': {
            'dailyRevenue':  9500,
            'daysPerWeek':   6,
            'monthsPerYear': 12,
            'turnover':      2941200,    # 9500 × 6 × 4.3 × 12
            'tier':          'basic',
            'fee':           100,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'Bread Cafe',
            'ownerName':    'Anastasia War',
            'bizPhone':     '9863010009',
            'addrLine1':    'Nongrim Hills',
            'addrLine2':    '',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793003',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
        },
        'ossCart': {
            'items': [
                {'id': 'medical-cert', 'name': 'Medical Certificate (Staff)', 'price': 299, 'qty': 1, 'type': 'health'},
            ],
            'total': 299,
        },

        'tier':          'basic',
        'fee':           100,
        'years':         3,
        'paymentMethod': 'upi',

        'applicationStatus': 'approved',
        'fssaiRating':       4.0,
        'grievances': [
            grievance(
                'GRV-2026-10009-01', 'hygiene',
                'Reported mold observed on displayed baked goods at counter.',
                'open',
                raised=dt(2026, 4, 28),
            ),
        ],

        'submittedAt': dt(2026, 1, 15),
        'updatedAt':   dt(2026, 3, 10),
        'review': {'years': 3, 'totalFee': 300},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2026, 1, 15)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2026, 2, 1)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  when=dt(2026, 2, 20)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 3, 1)),
            audit('Application approved', 'officer',
                  'approved',
                  when=dt(2026, 3, 10)),
        ],
    },

    # ── 10. Cafe 17 ───────────────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10010',
        'uid':         'seed_uid_010',
        'phone':       '9863010010',
        'displayName': 'Ribbhun Nongbet',

        'businessTypes': ['restaurant-cafe'],
        'foodTypes':     ['ready-to-eat', 'beverages', 'confectionery', 'dairy-analogues'],

        'scale': {
            'dailyRevenue':  60000,
            'daysPerWeek':   7,
            'monthsPerYear': 12,
            'turnover':      21636000,   # 60000 × 7 × 4.3 × 12
            'tier':          'state',
            'fee':           2000,
            'panIndia':      False,
        },
        'details': {
            'bizName':      'Cafe 17',
            'ownerName':    'Ribbhun Nongbet',
            'bizPhone':     '9863010010',
            'addrLine1':    'GS Road',
            'addrLine2':    'Near Shillong Club',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793001',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
            'form9': True, 'blueprint': True, 'waterTestReport': True,
        },
        'ossCart': {
            'items': [
                {'id': 'water-test',  'name': 'Water Analysis Report',      'price': 999, 'qty': 1, 'type': 'lab'},
                {'id': 'hygiene-kit', 'name': 'FSSAI Hygiene Training Kit', 'price': 449, 'qty': 1, 'type': 'training'},
            ],
            'total': 1448,
        },

        'tier':          'state',
        'fee':           2000,
        'years':         3,
        'paymentMethod': 'card',

        'applicationStatus': 'approved',
        'fssaiRating':       3.5,
        'grievances':        [],

        'submittedAt': dt(2026, 2, 5),
        'updatedAt':   dt(2026, 4, 20),
        'review': {'years': 3, 'totalFee': 6000},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2026, 2, 5)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2026, 2, 25)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  when=dt(2026, 3, 15)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 4, 5)),
            audit('Application approved', 'officer',
                  'approved',
                  when=dt(2026, 4, 20)),
        ],
    },

    # ── 11. Priya's Kitchen ───────────────────────────────────────────────────
    {
        'appId':       'FSSAI-2026-10011',
        'uid':         'seed_uid_011',
        'phone':       '9863010011',
        'displayName': 'Priya Kharmawlong',

        'businessTypes': ['restaurant-cafe', 'home-kitchen'],
        'foodTypes':     ['ready-to-eat', 'cereals', 'dairy-analogues', 'beverages'],

        'scale': {
            'dailyRevenue':  7000,
            'daysPerWeek':   6,
            'monthsPerYear': 12,
            'turnover':      2167200,    # 7000 × 6 × 4.3 × 12
            'tier':          'basic',
            'fee':           100,
            'panIndia':      False,
        },
        'details': {
            'bizName':      "Priya's Kitchen",
            'ownerName':    'Priya Kharmawlong',
            'bizPhone':     '9863010011',
            'addrLine1':    'Rilbong, Lapalang Road',
            'addrLine2':    '',
            'addrDistrict': 'East Khasi Hills',
            'addrState':    'Meghalaya',
            'addrPincode':  '793004',
        },
        'documents': {
            'selfie': True, 'idProof': True, 'addressProof': True,
        },
        'ossCart': {
            'items': [
                {'id': 'medical-cert', 'name': 'Medical Certificate (Staff)', 'price': 299, 'qty': 1, 'type': 'health'},
            ],
            'total': 299,
        },

        'tier':          'basic',
        'fee':           100,
        'years':         1,
        'paymentMethod': 'upi',

        'applicationStatus': 'approved',
        'fssaiRating':       3.9,
        'grievances':        [],

        'submittedAt': dt(2026, 3, 8),
        'updatedAt':   dt(2026, 4, 30),
        'review': {'years': 1, 'totalFee': 100},

        'auditTrail': [
            audit('Application submitted', 'citizen', when=dt(2026, 3, 8)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_scheduled',
                  when=dt(2026, 3, 25)),
            audit('Application advanced to next stage', 'officer',
                  'inspection_complete',
                  note='Home kitchen setup meets basic hygiene norms.',
                  when=dt(2026, 4, 10)),
            audit('Application advanced to next stage', 'officer',
                  'final_review',
                  when=dt(2026, 4, 22)),
            audit('Application approved', 'officer',
                  'approved',
                  when=dt(2026, 4, 30)),
        ],
    },
]


# ── Seed ──────────────────────────────────────────────────────────────────────

def seed():
    apps_ref  = db.collection('applications')
    users_ref = db.collection('users')

    print(f"Seeding {len(RESTAURANTS)} approved restaurants into Firestore...\n")

    for r in RESTAURANTS:
        app_id = r['appId']
        uid    = r['uid']

        # ── applications/{appId} ─────────────────────────────────────────────
        # Mirrors exactly what payment.js writes, plus officer-added fields.
        app_doc = {
            'appId':             app_id,
            'uid':               uid,
            'phone':             r['phone'],
            'displayName':       r['displayName'],
            'businessTypes':     r['businessTypes'],
            'foodTypes':         r['foodTypes'],
            'scale':             r['scale'],
            'details':           r['details'],
            'documents':         r['documents'],
            'ossCart':           r['ossCart'],
            'tier':              r['tier'],
            'fee':               r['fee'],
            'years':             r['years'],
            'paymentMethod':     r['paymentMethod'],
            'applicationStatus': r['applicationStatus'],
            'fssaiRating':       r['fssaiRating'],
            'grievances':        r['grievances'],
            'submittedAt':       r['submittedAt'],
            'updatedAt':         r['updatedAt'],
            'auditTrail':        r['auditTrail'],
        }

        # ── users/{uid} ──────────────────────────────────────────────────────
        # Mirrors what the registration flow accumulates plus the payment-time
        # stamp. fbo_portal.js showApproved() reads from this document.
        user_doc = {
            'applicationId':     app_id,
            'applicationStatus': r['applicationStatus'],
            'businessTypes':     r['businessTypes'],
            'foodTypes':         r['foodTypes'],
            'scale':             r['scale'],
            'details':           r['details'],
            'documents':         r['documents'],
            'ossCart':           r['ossCart'],
            'review':            r['review'],
            'fssaiRating':       r['fssaiRating'],
            'grievances':        r['grievances'],
            'submittedAt':       r['submittedAt'],
            'updatedAt':         r['updatedAt'],
        }

        apps_ref.document(app_id).set(app_doc)
        users_ref.document(uid).set(user_doc)

        biz  = r['details']['bizName']
        tier = r['tier']
        rating = r['fssaiRating']
        print(f"  OK  {app_id}  {biz:<30}  {tier:<7}  rating {rating}")

    print(f"\nDone. {len(RESTAURANTS)} documents written to 'applications' and 'users'.")


# ── Grievances ────────────────────────────────────────────────────────────────
#
# Writes demo consumer complaints into the top-level `grievances` collection.
# The `grievance.html` page will also write here. The officer portal reads all
# documents; the FBO portal reads only those where restaurantId matches.
# consumerName and consumerPhone are stored but the FBO rendering skips them.

GRIEVANCES = [
    {
        'restaurantId':   'FSSAI-2026-10002',
        'restaurantName': 'City Hut Family Dhaba',
        'category':       'hygiene',
        'ratings':        {'cleanliness': 2, 'freshness': 3, 'hygiene': 2},
        'overall':        2.3,
        'comment':        'Kitchen area was visibly unclean. Staff not wearing gloves.',
        'status':         'Action Taken',
        'filedAt':        dt(2026, 3, 14, 11, 22),
        'consumerName':   'Priya Sharma',
        'consumerPhone':  '+919876500001',
    },
    {
        'restaurantId':   'FSSAI-2026-10004',
        'restaurantName': 'Lamee Restaurant',
        'category':       'food-quality',
        'ratings':        {'cleanliness': 3, 'freshness': 2, 'hygiene': 3},
        'overall':        2.7,
        'comment':        'Rice had a stale smell. Momos were served cold.',
        'status':         'Action Taken',
        'filedAt':        dt(2026, 2, 28, 14, 5),
        'consumerName':   'Arjun Nongkynrih',
        'consumerPhone':  '+919876500002',
    },
    {
        'restaurantId':   'FSSAI-2026-10006',
        'restaurantName': 'ML 05 Cafe',
        'category':       'mislabelling',
        'ratings':        {'cleanliness': 3, 'freshness': 3, 'hygiene': 3},
        'overall':        3.0,
        'comment':        'Menu said "fresh juice" but was clearly packaged concentrate.',
        'status':         'Action Taken',
        'filedAt':        dt(2026, 1, 19, 9, 47),
        'consumerName':   'Meena Dkhar',
        'consumerPhone':  '+919876500003',
    },
    {
        'restaurantId':   'FSSAI-2026-10009',
        'restaurantName': 'Bread Cafe',
        'category':       'food-quality',
        'ratings':        {'cleanliness': 4, 'freshness': 2, 'hygiene': 4},
        'overall':        3.3,
        'comment':        'Bread was past expiry. Noticed mold on one end.',
        'status':         'Submitted',
        'filedAt':        dt(2026, 4, 30, 16, 12),
        'consumerName':   'Bah Khyriem',
        'consumerPhone':  '+919876500004',
    },
]


def seed_grievances():
    ref = db.collection('grievances')
    print(f"Seeding {len(GRIEVANCES)} grievances...\n")
    for g in GRIEVANCES:
        ref.add(g)
        print(f"  OK  {g['restaurantName']:<30}  {g['category']:<15}  {g['status']}")
    print(f"\nDone. {len(GRIEVANCES)} grievance documents written.")


if __name__ == '__main__':
    create_auth_users()
    seed()
    seed_grievances()
