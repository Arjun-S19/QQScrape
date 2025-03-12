import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { serverSupabase } from "@/lib/server-supabase"

// Create a limiter that allows 100 requests per minute
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per interval
})

export async function GET() {
  try {
    // Rate limiting
    await limiter.check(NextResponse, 100, "CHARTS_TOKEN")

    // Use the server-side Supabase client directly
    const supabase = serverSupabase

    // Fetch data with RLS policies applied
    const { data, error } = await supabase.from("charts").select("*")

    if (error) {
      console.error("Supabase error:", error)
      throw error
    }

    return NextResponse.json(
      { charts: data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    )
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

