import { createClient } from "@supabase/supabase-js"

// This file should only be imported in server components or API routes
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Create a single supabase client for server-side operations
export const serverSupabase = createClient(supabaseUrl, supabaseKey)

