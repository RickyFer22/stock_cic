export type ApiError = { error: string }

export function getToken() {
  return localStorage.getItem('sr_token')
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem('sr_token')
  else localStorage.setItem('sr_token', token)
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as ApiError).error || `HTTP ${res.status}`)
  return json as T
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as ApiError).error || `HTTP ${res.status}`)
  return json as T
}

export async function apiPut<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as ApiError).error || `HTTP ${res.status}`)
  return json as T
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as ApiError).error || `HTTP ${res.status}`)
  return json as T
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const res = await fetch(path, {
    headers: {
      Authorization: `Bearer ${getToken() || ''}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      throw new Error(json.error || `HTTP ${res.status}`)
    } catch {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`)
    }
  }
  const blob = await res.blob()
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const correctBlob = new Blob([blob], { type: contentType })
  const url = URL.createObjectURL(correctBlob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

export async function apiUploadExcel(path: string, file: File): Promise<any> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken() || ''}`,
    },
    body: fd,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as ApiError).error || `HTTP ${res.status}`)
  return json
}

