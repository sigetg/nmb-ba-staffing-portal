from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_admin, get_current_user
from app.core.supabase import get_supabase_client

router = APIRouter()


class JobTypeCreate(BaseModel):
    name: str
    description: str | None = None


class JobTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class KpiCreate(BaseModel):
    name: str
    label: str
    kpi_type: str = "numeric"
    aggregation: str = "sum"
    sort_order: int = 0


class KpiUpdate(BaseModel):
    name: str | None = None
    label: str | None = None
    aggregation: str | None = None
    sort_order: int | None = None


class QuestionOptionIn(BaseModel):
    label: str
    sort_order: int = 0


class QuestionCreate(BaseModel):
    question_text: str
    question_type: str  # 'multiple_choice' or 'free_text'
    is_required: bool = False
    sort_order: int = 0
    options: list[QuestionOptionIn] | None = None


class QuestionUpdate(BaseModel):
    question_text: str | None = None
    question_type: str | None = None
    is_required: bool | None = None
    sort_order: int | None = None
    options: list[QuestionOptionIn] | None = None


@router.get("/")
async def list_job_types(current_user: CurrentUser = Depends(get_current_user)):
    """List all non-archived job types with nested KPIs, questions, and options."""
    supabase = get_supabase_client()
    result = (
        supabase.table("job_types")
        .select("*, job_type_kpis(*), job_type_questions(*, job_type_question_options(*))")
        .eq("is_archived", False)
        .order("sort_order")
        .execute()
    )

    # Sort nested data
    for jt in result.data or []:
        if jt.get("job_type_kpis"):
            jt["job_type_kpis"].sort(key=lambda k: k.get("sort_order", 0))
        if jt.get("job_type_questions"):
            jt["job_type_questions"].sort(key=lambda q: q.get("sort_order", 0))
            for q in jt["job_type_questions"]:
                if q.get("job_type_question_options"):
                    q["job_type_question_options"].sort(key=lambda o: o.get("sort_order", 0))

    return result.data or []


@router.get("/{type_id}")
async def get_job_type(type_id: str, current_user: CurrentUser = Depends(get_current_user)):
    """Get a single job type with full schema."""
    supabase = get_supabase_client()
    result = (
        supabase.table("job_types")
        .select("*, job_type_kpis(*), job_type_questions(*, job_type_question_options(*))")
        .eq("id", type_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Job type not found")

    jt = result.data
    if jt.get("job_type_kpis"):
        jt["job_type_kpis"].sort(key=lambda k: k.get("sort_order", 0))
    if jt.get("job_type_questions"):
        jt["job_type_questions"].sort(key=lambda q: q.get("sort_order", 0))
        for q in jt["job_type_questions"]:
            if q.get("job_type_question_options"):
                q["job_type_question_options"].sort(key=lambda o: o.get("sort_order", 0))

    return jt


@router.post("/")
async def create_job_type(
    data: JobTypeCreate, current_user: CurrentUser = Depends(get_current_admin)
):
    """Create a new job type."""
    supabase = get_supabase_client()

    # Get next sort_order
    existing = (
        supabase.table("job_types")
        .select("sort_order")
        .order("sort_order", desc=True)
        .limit(1)
        .execute()
    )
    next_order = (existing.data[0]["sort_order"] + 1) if existing.data else 0

    result = (
        supabase.table("job_types")
        .insert({"name": data.name, "description": data.description, "sort_order": next_order})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job type")
    return result.data[0]


@router.patch("/{type_id}")
async def update_job_type(
    type_id: str, data: JobTypeUpdate, current_user: CurrentUser = Depends(get_current_admin)
):
    """Update a job type name/description."""
    supabase = get_supabase_client()
    update = {}
    if data.name is not None:
        update["name"] = data.name
    if data.description is not None:
        update["description"] = data.description
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("job_types").update(update).eq("id", type_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job type not found")
    return result.data[0]


@router.delete("/{type_id}")
async def archive_job_type(type_id: str, current_user: CurrentUser = Depends(get_current_admin)):
    """Soft-delete (archive) a job type."""
    supabase = get_supabase_client()
    result = supabase.table("job_types").update({"is_archived": True}).eq("id", type_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job type not found")
    return {"message": "Job type archived"}


# --- KPI endpoints ---


@router.post("/{type_id}/kpis")
async def add_kpi(
    type_id: str, data: KpiCreate, current_user: CurrentUser = Depends(get_current_admin)
):
    supabase = get_supabase_client()
    result = (
        supabase.table("job_type_kpis")
        .insert(
            {
                "job_type_id": type_id,
                "name": data.name,
                "label": data.label,
                "kpi_type": data.kpi_type,
                "aggregation": data.aggregation,
                "sort_order": data.sort_order,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add KPI")
    return result.data[0]


@router.patch("/{type_id}/kpis/{kpi_id}")
async def update_kpi(
    type_id: str,
    kpi_id: str,
    data: KpiUpdate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    supabase = get_supabase_client()
    update = {}
    for field in ["name", "label", "aggregation", "sort_order"]:
        val = getattr(data, field, None)
        if val is not None:
            update[field] = val
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = (
        supabase.table("job_type_kpis")
        .update(update)
        .eq("id", kpi_id)
        .eq("job_type_id", type_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="KPI not found")
    return result.data[0]


@router.delete("/{type_id}/kpis/{kpi_id}")
async def delete_kpi(
    type_id: str, kpi_id: str, current_user: CurrentUser = Depends(get_current_admin)
):
    supabase = get_supabase_client()
    supabase.table("job_type_kpis").delete().eq("id", kpi_id).eq("job_type_id", type_id).execute()
    return {"message": "KPI deleted"}


# --- Question endpoints ---


@router.post("/{type_id}/questions")
async def add_question(
    type_id: str, data: QuestionCreate, current_user: CurrentUser = Depends(get_current_admin)
):
    supabase = get_supabase_client()
    result = (
        supabase.table("job_type_questions")
        .insert(
            {
                "job_type_id": type_id,
                "question_text": data.question_text,
                "question_type": data.question_type,
                "is_required": data.is_required,
                "sort_order": data.sort_order,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add question")

    question = result.data[0]

    # Insert options for multiple choice
    if data.question_type == "multiple_choice" and data.options:
        for opt in data.options:
            supabase.table("job_type_question_options").insert(
                {
                    "question_id": question["id"],
                    "label": opt.label,
                    "sort_order": opt.sort_order,
                }
            ).execute()

    # Re-fetch with options
    full = (
        supabase.table("job_type_questions")
        .select("*, job_type_question_options(*)")
        .eq("id", question["id"])
        .single()
        .execute()
    )
    return full.data


@router.patch("/{type_id}/questions/{q_id}")
async def update_question(
    type_id: str,
    q_id: str,
    data: QuestionUpdate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    supabase = get_supabase_client()
    update = {}
    for field in ["question_text", "question_type", "is_required", "sort_order"]:
        val = getattr(data, field, None)
        if val is not None:
            update[field] = val
    if update:
        supabase.table("job_type_questions").update(update).eq("id", q_id).eq(
            "job_type_id", type_id
        ).execute()

    # Replace options if provided
    if data.options is not None:
        supabase.table("job_type_question_options").delete().eq("question_id", q_id).execute()
        for opt in data.options:
            supabase.table("job_type_question_options").insert(
                {
                    "question_id": q_id,
                    "label": opt.label,
                    "sort_order": opt.sort_order,
                }
            ).execute()

    # Re-fetch
    full = (
        supabase.table("job_type_questions")
        .select("*, job_type_question_options(*)")
        .eq("id", q_id)
        .single()
        .execute()
    )
    return full.data


@router.delete("/{type_id}/questions/{q_id}")
async def delete_question(
    type_id: str, q_id: str, current_user: CurrentUser = Depends(get_current_admin)
):
    supabase = get_supabase_client()
    supabase.table("job_type_questions").delete().eq("id", q_id).eq(
        "job_type_id", type_id
    ).execute()
    return {"message": "Question deleted"}
