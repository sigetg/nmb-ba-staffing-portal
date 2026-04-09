const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiRequest(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `API error ${res.status}`)
  }
  return res
}

export async function uploadJobPhoto(
  accessToken: string,
  file: File,
  jobId: string,
  photoType: string,
  jobDayLocationId?: string
): Promise<{ id: string; url: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('job_id', jobId)
  form.append('photo_type', photoType)
  if (jobDayLocationId) form.append('job_day_location_id', jobDayLocationId)

  const res = await apiRequest('/api/files/upload/job-photo', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function deleteJobPhoto(
  accessToken: string,
  photoId: string
): Promise<void> {
  await apiRequest(`/api/files/job-photo/${photoId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function uploadBAPhoto(
  accessToken: string,
  file: File,
  photoType: string
): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('photo_type', photoType)

  const res = await apiRequest('/api/files/upload/ba-photo', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function uploadBAResume(
  accessToken: string,
  file: File
): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)

  const res = await apiRequest('/api/files/upload/ba-resume', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function uploadJobWorksheet(
  accessToken: string,
  file: File,
  jobId: string
): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('job_id', jobId)

  const res = await apiRequest('/api/files/upload/job-worksheet', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function deleteJobWorksheet(
  accessToken: string,
  jobId: string
): Promise<void> {
  await apiRequest(`/api/files/job-worksheet/${jobId}`, accessToken, {
    method: 'DELETE',
  })
}
