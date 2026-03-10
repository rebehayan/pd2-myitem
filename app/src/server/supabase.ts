import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const isDev = process.env.NODE_ENV !== 'production'

export const supabaseConfigured = Boolean(supabaseUrl && serviceRoleKey)

if (!supabaseConfigured && isDev) {
  console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; running in local fallback mode')
}

export const supabaseAdmin =
  supabaseConfigured && supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null
