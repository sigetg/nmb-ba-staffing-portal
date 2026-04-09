from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_admin
from app.core.supabase import get_supabase_client

router = APIRouter()


class ReportRequest(BaseModel):
    job_ids: list[str]


@router.post("/generate")
async def generate_report(
    data: ReportRequest, current_user: CurrentUser = Depends(get_current_admin)
):
    """Generate aggregated report data for given job IDs."""
    supabase = get_supabase_client()

    if not data.job_ids:
        raise HTTPException(status_code=400, detail="No job IDs provided")

    # Fetch jobs with type info
    jobs = (
        supabase.table("jobs")
        .select("*, job_types(id, name), job_days(*, job_day_locations(*))")
        .in_("id", data.job_ids)
        .execute()
    )
    if not jobs.data:
        raise HTTPException(status_code=404, detail="No jobs found")

    # Verify all jobs are same type
    type_ids = {j.get("job_type_id") for j in jobs.data if j.get("job_type_id")}
    if len(type_ids) > 1:
        raise HTTPException(status_code=400, detail="All jobs must be the same type for a report")

    job_type_id = type_ids.pop() if type_ids else None

    # Fetch job type schema
    job_type = None
    if job_type_id:
        jt = (
            supabase.table("job_types")
            .select("*, job_type_kpis(*), job_type_questions(*, job_type_question_options(*))")
            .eq("id", job_type_id)
            .single()
            .execute()
        )
        job_type = jt.data

    # Fetch all checkout responses for these jobs
    responses = (
        supabase.table("checkout_responses")
        .select("*, checkout_response_values(*)")
        .in_("job_id", data.job_ids)
        .execute()
    )

    # Fetch BA profiles for names
    ba_ids = list({r["ba_id"] for r in (responses.data or [])})
    ba_map = {}
    if ba_ids:
        bas = supabase.table("ba_profiles").select("id, name").in_("id", ba_ids).execute()
        ba_map = {b["id"]: b["name"] for b in (bas.data or [])}

    # Fetch attendance data (location_check_ins)
    attendance = []
    for job_id in data.job_ids:
        # Multi-day check-ins
        loc_checkins = (
            supabase.table("location_check_ins")
            .select(
                "*, job_day_locations!inner(job_id, location, job_day_id, job_days:job_day_id(date))"
            )
            .eq("job_day_locations.job_id", job_id)
            .execute()
        )
        for lci in loc_checkins.data or []:
            attendance.append(
                {
                    "job_id": job_id,
                    "ba_id": lci["ba_id"],
                    "ba_name": ba_map.get(lci["ba_id"], "Unknown"),
                    "check_in_time": lci["check_in_time"],
                    "check_out_time": lci.get("check_out_time"),
                    "location": lci.get("job_day_locations", {}).get("location"),
                }
            )

        # Legacy check-ins
        legacy = supabase.table("check_ins").select("*").eq("job_id", job_id).execute()
        for ci in legacy.data or []:
            attendance.append(
                {
                    "job_id": job_id,
                    "ba_id": ci["ba_id"],
                    "ba_name": ba_map.get(ci["ba_id"], "Unknown"),
                    "check_in_time": ci["check_in_time"],
                    "check_out_time": ci.get("check_out_time"),
                    "location": None,
                }
            )

    # Fetch photos
    photos = supabase.table("job_photos").select("*").in_("job_id", data.job_ids).execute()

    # Build per-BA response data
    per_ba_responses = {}
    for resp in responses.data or []:
        ba_id = resp["ba_id"]
        job_id = resp["job_id"]
        key = f"{ba_id}_{job_id}"
        if key not in per_ba_responses:
            per_ba_responses[key] = {
                "ba_id": ba_id,
                "ba_name": ba_map.get(ba_id, "Unknown"),
                "job_id": job_id,
                "values": [],
            }
        per_ba_responses[key]["values"].extend(resp.get("checkout_response_values", []))

    # Aggregate KPI data
    kpi_aggregates = {}
    mc_aggregates = {}

    for resp in responses.data or []:
        for val in resp.get("checkout_response_values", []):
            if val.get("kpi_id") and val.get("numeric_value") is not None:
                kpi_id = val["kpi_id"]
                if kpi_id not in kpi_aggregates:
                    kpi_aggregates[kpi_id] = {"values": [], "sum": 0}
                kpi_aggregates[kpi_id]["values"].append(float(val["numeric_value"]))
                kpi_aggregates[kpi_id]["sum"] += float(val["numeric_value"])

            if val.get("question_id") and val.get("option_id"):
                q_id = val["question_id"]
                opt_id = val["option_id"]
                if q_id not in mc_aggregates:
                    mc_aggregates[q_id] = {}
                mc_aggregates[q_id][opt_id] = mc_aggregates[q_id].get(opt_id, 0) + 1

    # Calculate averages
    for _kpi_id, agg in kpi_aggregates.items():
        count = len(agg["values"])
        agg["avg"] = round(agg["sum"] / count, 2) if count > 0 else 0
        agg["count"] = count

    # Calculate MC percentages
    for q_id, options in mc_aggregates.items():
        total = sum(options.values())
        mc_aggregates[q_id] = {
            opt_id: {
                "count": count,
                "percentage": round(count / total * 100, 1) if total > 0 else 0,
            }
            for opt_id, count in options.items()
        }

    return {
        "jobs": jobs.data,
        "job_type": job_type,
        "kpi_aggregates": kpi_aggregates,
        "mc_aggregates": mc_aggregates,
        "per_ba_responses": list(per_ba_responses.values()),
        "attendance": attendance,
        "photos": photos.data or [],
        "ba_map": ba_map,
    }
