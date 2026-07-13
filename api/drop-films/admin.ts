declare const process: {
  env: {
    DROP_FILMS_ADMIN_PASSWORD?: string
  }
}

type ApiRequest = {
  body?: unknown
  method?: string
}

type ApiResponse = {
  json: (body: unknown) => void
  status: (code: number) => ApiResponse
}

const dropFilmAdminPassword = process.env.DROP_FILMS_ADMIN_PASSWORD ?? 'saltwater-sand-30'

async function readJsonBody<T>(request: ApiRequest): Promise<T> {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T
  }

  if (request.body && typeof request.body === 'object') {
    return request.body as T
  }

  return {} as T
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const body = await readJsonBody<{ password?: string }>(request).catch(
    (): { password?: string } => ({}),
  )

  if (body.password !== dropFilmAdminPassword) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  return response.status(200).json({ ok: true })
}
