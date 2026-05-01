import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_base_template(body_html: str) -> str:
    """Shared HTML wrapper with NMB branding."""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #E8853D; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">NMB Media</h1>
        </div>
        <div style="padding: 32px 24px; background-color: #ffffff;">
            {body_html}
        </div>
        <div style="padding: 16px 24px; background-color: #f5f5f5; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
                NMB Media Staffing Portal
            </p>
        </div>
    </div>
    """


def _cta_button(text: str, path: str) -> str:
    """Generate a CTA button linking to the frontend."""
    url = f"{settings.frontend_url}{path}"
    return f"""
    <div style="text-align: center; margin: 32px 0;">
        <a href="{url}"
           style="display: inline-block; background-color: #E8853D; color: white;
                  padding: 12px 32px; text-decoration: none; border-radius: 8px;
                  font-weight: 600;">
            {text}
        </a>
    </div>
    """


def _send_email(to_email: str, subject: str, body_html: str) -> bool:
    """Send an email via Resend. Returns True on success, False on failure. Never raises."""
    if not settings.resend_api_key:
        logger.warning("Resend API key not configured, skipping email to %s", to_email)
        return False

    try:
        import resend

        resend.api_key = settings.resend_api_key

        html = _get_base_template(body_html)

        resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )

        logger.info("Email sent to %s: %s", to_email, subject)
        return True

    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False


def _first_name(name: str | None) -> str:
    return name.split(" ")[0] if name else "there"


def get_ba_email(supabase, ba_id: str) -> tuple[str | None, str | None]:
    """Resolve ba_id -> (email, name) via ba_profiles -> users join."""
    try:
        profile = (
            supabase.table("ba_profiles").select("name, user_id").eq("id", ba_id).single().execute()
        )
        if not profile.data:
            return None, None

        user = (
            supabase.table("users")
            .select("email")
            .eq("id", profile.data["user_id"])
            .single()
            .execute()
        )
        if not user.data:
            return None, profile.data.get("name")

        return user.data["email"], profile.data["name"]
    except Exception:
        return None, None


def get_job_display_info(supabase, job_id: str, job_data: dict | None = None) -> dict:
    """Get display-ready date, location, start_time for a job from job_days.
    Returns {"date": str, "location": str, "start_time": str}."""
    # Check if job_days already in job_data
    days = (job_data or {}).get("job_days")
    if days is None:
        result = (
            supabase.table("job_days")
            .select("date, job_day_locations(location, start_time)")
            .eq("job_id", job_id)
            .order("date")
            .execute()
        )
        days = result.data or []

    if not days:
        return {"date": "", "location": "", "start_time": ""}

    sorted_days = sorted(days, key=lambda d: d["date"])
    first, last = sorted_days[0], sorted_days[-1]

    date = (
        first["date"] if first["date"] == last["date"] else f"{first['date']} to {last['date']}"
    )

    location = ""
    start_time = ""
    first_locs = sorted_days[0].get("job_day_locations") or []
    if first_locs:
        location = first_locs[0].get("location", "")
        all_locs = set()
        for d in sorted_days:
            for loc in d.get("job_day_locations") or []:
                all_locs.add(loc.get("location", ""))
        if len(all_locs) > 1:
            location = f"{first_locs[0]['location']} (+{len(all_locs) - 1} more)"
        start_time = first_locs[0].get("start_time", "")

    return {"date": date, "location": location, "start_time": start_time}


# --- Individual email functions ---


def _notes_block(notes: str | None) -> str:
    """Generate an HTML block for admin notes if provided."""
    if not notes:
        return ""
    return f"""
    <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 4px; color: #666; font-weight: 600;">Note from our team:</p>
        <p style="margin: 0; color: #4a4a4a;">{notes}</p>
    </div>
    """


def send_ba_approved_email(to_email: str, name: str | None, notes: str | None = None) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Congratulations, {first}!</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        Your Brand Ambassador profile has been approved.
    </p>
    <p style="color: #4a4a4a; line-height: 1.6;">
        <strong>One more step</strong> before you can apply for jobs: complete your tax info (W-9)
        and pick how you'd like to be paid. Takes about 2 minutes.
    </p>
    {_notes_block(notes)}
    {_cta_button("Complete Onboarding", "/dashboard/welcome")}
    <p style="color: #4a4a4a; line-height: 1.6;">
        Welcome to the team!
    </p>
    """
    return _send_email(to_email, "Welcome to NMB Media - You're Approved!", body)


def send_payment_sent_email(
    to_email: str,
    name: str | None,
    *,
    amount: float,
    method: str,
    job_title: str | None,
    reference: str | None = None,
) -> bool:
    """Notify a BA that a payment has been sent / completed."""
    first = _first_name(name)
    method_label = "ACH (Direct Deposit)" if method == "ach_batch" else "PayPal/Venmo" if method == "paypal" else method
    eta = "1-3 business days" if method == "ach_batch" else "instantly"
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Payment sent, {first}!</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        We've just sent your payment for completed work.
    </p>
    <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Amount:</strong> ${amount:.2f}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Method:</strong> {method_label}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Arrives:</strong> {eta}</p>
        {f'<p style="margin: 4px 0; color: #4a4a4a;"><strong>Job:</strong> {job_title}</p>' if job_title else ''}
        {f'<p style="margin: 4px 0; color: #4a4a4a; font-size: 12px;">Ref: {reference}</p>' if reference else ''}
    </div>
    <p style="color: #4a4a4a; line-height: 1.6;">
        You can view all of your payments any time from your portal profile.
    </p>
    {_cta_button("View Payments", "/dashboard/profile")}
    """
    return _send_email(to_email, f"NMB Media - Payment Sent (${amount:.2f})", body)


def send_ba_rejected_email(to_email: str, name: str | None, notes: str | None = None) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Hi {first},</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        Thank you for your interest in joining NMB Media as a Brand Ambassador.
        After reviewing your profile, we're unable to approve your application at this time.
    </p>
    {_notes_block(notes)}
    <p style="color: #4a4a4a; line-height: 1.6;">
        If you have any questions, please don't hesitate to reach out to us.
    </p>
    """
    return _send_email(to_email, "NMB Media - Application Update", body)


def send_ba_suspended_email(to_email: str, name: str | None, notes: str | None = None) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Hi {first},</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        Your Brand Ambassador account has been temporarily suspended.
        You will not be able to apply for or participate in jobs during this time.
    </p>
    {_notes_block(notes)}
    <p style="color: #4a4a4a; line-height: 1.6;">
        If you believe this is an error or have questions, please contact us.
    </p>
    """
    return _send_email(to_email, "NMB Media - Account Update", body)


def send_ba_reinstated_email(to_email: str, name: str | None, notes: str | None = None) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Welcome back, {first}!</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        Great news! Your Brand Ambassador account has been reinstated.
        You can now browse and apply for available jobs again.
    </p>
    {_notes_block(notes)}
    {_cta_button("Go to Dashboard", "/dashboard")}
    <p style="color: #4a4a4a; line-height: 1.6;">
        We're glad to have you back on the team!
    </p>
    """
    return _send_email(to_email, "NMB Media - Welcome Back!", body)


def send_application_confirmed_email(
    to_email: str,
    name: str | None,
    job_title: str,
    job_date: str,
    job_location: str,
) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Hi {first},</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        Your application has been received! Here are the details:
    </p>
    <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Job:</strong> {job_title}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Date:</strong> {job_date}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Location:</strong> {job_location}</p>
    </div>
    <p style="color: #4a4a4a; line-height: 1.6;">
        We'll review your application and get back to you soon.
    </p>
    {_cta_button("View My Jobs", "/dashboard")}
    """
    return _send_email(to_email, "NMB Media - Application Received", body)


def send_application_approved_email(
    to_email: str,
    name: str | None,
    job_title: str,
    job_date: str,
    job_location: str,
    start_time: str,
    job_id: str,
    notes: str | None = None,
) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Great news, {first}!</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        You've been assigned to the following job:
    </p>
    <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Job:</strong> {job_title}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Date:</strong> {job_date}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Start Time:</strong> {start_time}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Location:</strong> {job_location}</p>
    </div>
    {_notes_block(notes)}
    <p style="color: #4a4a4a; line-height: 1.6;">
        Please make sure to arrive on time and check in when you get there.
    </p>
    {_cta_button("View Job Details", f"/dashboard/jobs/{job_id}")}
    """
    return _send_email(to_email, f"NMB Media - You're Assigned to {job_title}!", body)


def send_application_rejected_email(
    to_email: str,
    name: str | None,
    job_title: str,
    notes: str | None = None,
) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Hi {first},</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        Thank you for applying to <strong>{job_title}</strong>. Unfortunately,
        we were unable to assign you to this job at this time.
    </p>
    {_notes_block(notes)}
    <p style="color: #4a4a4a; line-height: 1.6;">
        Don't worry — new jobs are posted regularly. Keep checking for
        opportunities that match your availability!
    </p>
    {_cta_button("Browse Jobs", "/dashboard")}
    """
    return _send_email(to_email, "NMB Media - Application Update", body)


def send_job_reminder_email(
    to_email: str,
    name: str | None,
    job_title: str,
    job_date: str,
    job_location: str,
    start_time: str,
    job_id: str,
) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Reminder, {first}!</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        Just a friendly reminder that you have a job coming up tomorrow:
    </p>
    <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Job:</strong> {job_title}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Date:</strong> {job_date}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Start Time:</strong> {start_time}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Location:</strong> {job_location}</p>
    </div>
    <p style="color: #4a4a4a; line-height: 1.6;">
        Please arrive on time and don't forget to check in when you get there!
    </p>
    {_cta_button("View Job Details", f"/dashboard/jobs/{job_id}")}
    """
    return _send_email(to_email, f"NMB Media - Reminder: {job_title} Tomorrow", body)


def send_job_cancelled_email(
    to_email: str,
    name: str | None,
    job_title: str,
    job_date: str,
) -> bool:
    first = _first_name(name)
    body = f"""
    <h2 style="color: #1a1a1a; margin-top: 0;">Hi {first},</h2>
    <p style="color: #4a4a4a; line-height: 1.6;">
        We regret to inform you that the following job has been cancelled:
    </p>
    <div style="background-color: #f9f9f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Job:</strong> {job_title}</p>
        <p style="margin: 4px 0; color: #4a4a4a;"><strong>Date:</strong> {job_date}</p>
    </div>
    <p style="color: #4a4a4a; line-height: 1.6;">
        We apologize for the inconvenience. Please check the portal for other
        available opportunities.
    </p>
    {_cta_button("Browse Jobs", "/dashboard")}
    """
    return _send_email(to_email, f"NMB Media - Job Cancelled: {job_title}", body)
