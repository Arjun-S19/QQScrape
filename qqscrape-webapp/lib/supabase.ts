import { createClient } from "@supabase/supabase-js"

// These environment variables need to be set in your Vercel project
// For GitHub Pages, we'll hardcode them (not ideal for security, but necessary for static sites)
// In production, you should consider using environment variables with a proper CI/CD setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create a single supabase client for the entire app
export const supabase = createClient(supabaseUrl, supabaseKey)

