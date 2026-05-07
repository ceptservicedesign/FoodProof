import os
from flask import Flask, render_template, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)


def placeholder(page_name, page_id):
    return render_template('_placeholder.html', page_name=page_name, page_id=page_id)


# ── Firebase config (served to frontend) ─────────────────────
@app.route('/api/firebase-config')
def firebase_config():
    return jsonify({
        'apiKey':            os.getenv('FIREBASE_API_KEY', ''),
        'authDomain':        os.getenv('FIREBASE_AUTH_DOMAIN', ''),
        'projectId':         os.getenv('FIREBASE_PROJECT_ID', ''),
        'storageBucket':     os.getenv('FIREBASE_STORAGE_BUCKET', ''),
        'messagingSenderId': os.getenv('FIREBASE_MESSAGING_SENDER_ID', ''),
        'appId':             os.getenv('FIREBASE_APP_ID', ''),
    })


# ── Home ─────────────────────────────────────────────────────
@app.route('/')
def home():
    return render_template('index.html')


# ── Navbar links (public) ─────────────────────────────────────
@app.route('/regulations')
def regulations():
    return placeholder('Regulations', 'regulations')

@app.route('/latest-updates')
def latest_updates():
    return placeholder('Latest Updates', 'latest-updates')

@app.route('/about-fssai')
def about_fssai():
    return placeholder('About FSSAI', 'about-fssai')


# ── New user signup flow ──────────────────────────────────────
@app.route('/signup')
def signup():
    return render_template('signup.html')

@app.route('/signup/verify')
def signup_verify():
    return render_template('signup_verify.html')


# ── Help modal destinations ───────────────────────────────────
@app.route('/consumer')
def consumer():
    return placeholder('Consumer', 'consumer')

@app.route('/agent')
def agent():
    return render_template('agent_login.html')

@app.route('/agent/verify')
def agent_verify():
    return render_template('agent_verify.html')

@app.route('/agent/dashboard')
def agent_dashboard():
    return render_template('agent_dashboard.html')

@app.route('/agent/client')
def agent_client():
    return render_template('agent_client.html')

@app.route('/agent/add-client')
def agent_add_client():
    return render_template('agent_add_client.html')

@app.route('/agent/claim-otp')
def agent_claim_otp():
    return render_template('agent_claim_otp.html')

@app.route('/fbo-portal')
def fbo_portal():
    return render_template('fbo_portal.html')


# ── Registration flow ─────────────────────────────────────────
@app.route('/about-business')
def about_business():
    return render_template('about_business.html')

@app.route('/food-type')
def food_type():
    return render_template('food_type.html')

@app.route('/scale')
def scale():
    return render_template('scale.html')

@app.route('/business-details')
def business_details():
    return render_template('business_details.html')

@app.route('/documents')
def documents():
    return render_template('documents.html')

@app.route('/review')
def review():
    return render_template('review.html')

@app.route('/payment')
def payment():
    return render_template('payment.html')

@app.route('/application-submitted')
def application_submitted():
    return render_template('application_submitted.html')

@app.route('/track-application')
def track_application():
    return render_template('track_application.html')

@app.route('/temp-license')
def temp_license():
    return render_template('tl_eligibility.html')

@app.route('/temp-license/purpose')
def tl_purpose():
    return render_template('tl_purpose.html')

@app.route('/temp-license/details')
def tl_details():
    return render_template('tl_details.html')

@app.route('/temp-license/photos')
def tl_photos():
    return render_template('tl_photos.html')

@app.route('/temp-license/docs')
def tl_docs():
    return render_template('tl_docs.html')

@app.route('/temp-license/terms')
def tl_terms():
    return render_template('tl_terms.html')

@app.route('/temp-license/issued')
def tl_issued():
    return render_template('tl_issued.html')

@app.route('/temp-license/next-steps')
def tl_next_steps():
    return render_template('tl_next_steps.html')


# ── Protected service pages ───────────────────────────────────
@app.route('/help')
def help_page():
    return placeholder('Hello — How Can We Help?', 'help')

@app.route('/apply-permanent-license')
def permanent_license():
    return placeholder('Apply for Permanent License', 'apply-permanent-license')

@app.route('/temporary-license')
def temporary_license():
    return placeholder('Temporary License', 'temporary-license')

@app.route('/renew-license')
def renew_license():
    return placeholder('Renew License', 'renew-license')

@app.route('/check-status')
def check_status():
    return placeholder('Check License Status', 'check-status')

@app.route('/one-stop-shop')
def one_stop_shop():
    return render_template('one_stop_shop.html')

@app.route('/consumer-corner')
def consumer_corner():
    return placeholder('Consumer Corner', 'consumer-corner')

@app.route('/updates')
def updates():
    return placeholder('Latest Updates & Regulations', 'updates')


# ── Officer Portal ────────────────────────────────────────────
@app.route('/officer/login')
def officer_login():
    return render_template('officer/login.html')

@app.route('/officer/dashboard')
def officer_dashboard():
    return render_template('officer/dashboard.html')

@app.route('/officer/applications')
def officer_applications():
    return render_template('officer/applications.html')

@app.route('/officer/applications/<app_id>')
def officer_application_detail(app_id):
    return render_template('officer/application_detail.html', app_id=app_id)

@app.route('/officer/temp-licenses')
def officer_temp_licenses():
    return render_template('officer/temp_licenses.html')

@app.route('/officer/fbo-directory')
def officer_fbo_directory():
    return render_template('officer/fbo_directory.html')

@app.route('/officer/fbo-directory/<fbo_id>')
def officer_fbo_profile(fbo_id):
    return render_template('officer/fbo_profile.html', fbo_id=fbo_id)

@app.route('/officer/inspections')
def officer_inspections():
    return render_template('officer/inspections.html')

@app.route('/officer/inspections/regulatory/<app_id>')
def officer_inspection_regulatory(app_id):
    return render_template('officer/inspection_detail.html', inspection_type='regulatory', inspection_id=app_id)

@app.route('/officer/inspections/surveillance/<grv_id>')
def officer_inspection_surveillance(grv_id):
    return render_template('officer/inspection_detail.html', inspection_type='surveillance', inspection_id=grv_id)

@app.route('/officer/sampling')
def officer_sampling():
    return render_template('officer/sampling.html')

@app.route('/officer/clean-kitchen-league')
def officer_ckl():
    return render_template('officer/clean_kitchen_league.html')

@app.route('/officer/profile')
def officer_profile():
    return render_template('officer/profile.html')

@app.route('/officer/grievances')
def officer_grievances():
    return render_template('officer/grievances.html')

@app.route('/officer/grievances/<grv_id>')
def officer_grievance_detail(grv_id):
    return render_template('officer/grievance_detail.html', grv_id=grv_id)

@app.route('/modify-license')
def modify_license():
    return render_template('modify_license.html')

@app.route('/fbo-grievances')
def fbo_grievances():
    return render_template('fbo_grievances.html')

@app.route('/fbo-grievances/<grv_id>')
def fbo_grievance_detail(grv_id):
    return render_template('fbo_grievance_detail.html', grv_id=grv_id)

@app.route('/grievance')
def grievance():
    return render_template('grievance.html')

if __name__ == '__main__':
    app.run(debug=True, port=5001)
