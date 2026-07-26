import { createClient, type SupabaseClient } from '@supabase/supabase-js'

declare const process: {
  env: {
    SUPABASE_SERVICE_ROLE_KEY?: string
    SUPABASE_URL?: string
  }
}

export type ProductRow = {
  aliases: string[] | null
  categories: string[] | null
  collection: string
  created_at: string
  deleted_at: string | null
  description: string
  feel: string
  id: string
  image_position_x: number
  image_position_y: number
  inventory_quantity: number | null
  name: string
  price: number | null
  sku: string
  sort_order: number
  status: 'draft' | 'published'
  subtitle: string
  tag: string
  updated_at: string
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL?.trim()
    && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase is not configured.')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
