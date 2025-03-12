"use client"

import { useEffect, useState, useRef } from "react"
import {
  Music,
  Play,
  ArrowDown,
  ArrowUp,
  Minus,
  Plus,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableRow, TableHeader } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ErrorBoundary } from "@/components/error-boundary"
import { SimpleChart } from "@/components/simple-chart"
import { supabase } from "@/lib/supabase"

// Define types for our data
interface Track {
  id: string
  title: string
  artist: string
  song_mid: string
  created_at: string
}

interface DailySnapshot {
  id: string
  track_id: string
  chart_id: string
  yesterday_rank: string | null
  today_rank: string
  trend: string
  longevity: string
  date_scraped: string
}

interface Chart {
  id: string
  name: string
  created_at: string
}

interface SongWithRank extends Track {
  rank: string
  previousRank: string | null
  trend: string
  longevity: string
  chartId: string
}

interface HistoricalData {
  date: string
  rank: number
}

type SortDirection = "asc" | "desc" | null
type SortColumn = "rank" | "title" | "artist" | "longevity" | null

export default function Dashboard() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [dailySnapshots, setDailySnapshots] = useState<DailySnapshot[]>([])
  const [charts, setCharts] = useState<Chart[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChart, setSelectedChart] = useState<string>("")
  const [selectedSong, setSelectedSong] = useState<SongWithRank | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([])
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const tabsListRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Track API request count to implement basic rate limiting
  const [requestCount, setRequestCount] = useState(0)
  const MAX_REQUESTS_PER_MINUTE = 100
  const requestTimestamps = useRef<number[]>([])

  // Basic rate limiting function
  const checkRateLimit = () => {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000

    // Remove timestamps older than 1 minute
    requestTimestamps.current = requestTimestamps.current.filter((timestamp) => timestamp > oneMinuteAgo)

    // Add current timestamp
    requestTimestamps.current.push(now)

    // Check if we've exceeded the limit
    return requestTimestamps.current.length <= MAX_REQUESTS_PER_MINUTE
  }

  // Improved fetch function with better error handling
  // const fetchFromApi = async (url: string) => {
  //   const response = await fetch(url)

  //   // Check if the response is OK
  //   if (!response.ok) {
  //     const contentType = response.headers.get("content-type")
  //     if (contentType && contentType.includes("application/json")) {
  //       // If it's JSON, parse the error
  //       const errorData = await response.json()
  //       throw new Error(errorData.error || `API error: ${response.status}`)
  //     } else {
  //       // If it's not JSON, throw a generic error
  //       throw new Error(`API returned ${response.status}: ${response.statusText}`)
  //     }
  //   }

  //   // Parse JSON response
  //   const contentType = response.headers.get("content-type")
  //   if (!contentType || !contentType.includes("application/json")) {
  //     throw new Error("API did not return JSON")
  //   }

  //   return response.json()
  // }

  // Fetch data from API
  // const fetchData = async () => {
  //   try {
  //     setLoading(true)
  //     setError(null)

  //     // Fetch tracks data from API
  //     const tracksResponse = await fetch("/api/tracks")
  //     if (!tracksResponse.ok) {
  //       const errorData = await tracksResponse.json().catch(() => ({}))
  //       throw new Error(`Error fetching tracks: ${errorData.error || tracksResponse.statusText}`)
  //     }
  //     const tracksData = await tracksResponse.json()
  //     setTracks(tracksData.tracks || [])

  //     // Fetch daily snapshots data from API
  //     const snapshotsResponse = await fetch("/api/snapshots")
  //     if (!snapshotsResponse.ok) {
  //       const errorData = await snapshotsResponse.json().catch(() => ({}))
  //       throw new Error(`Error fetching snapshots: ${errorData.error || snapshotsResponse.statusText}`)
  //     }
  //     const snapshotsData = await snapshotsResponse.json()
  //     setDailySnapshots(snapshotsData.snapshots || [])

  //     // Fetch charts data from API
  //     const chartsResponse = await fetch("/api/charts")
  //     if (!chartsResponse.ok) {
  //       const errorData = await chartsResponse.json().catch(() => ({}))
  //       throw new Error(`Error fetching charts: ${errorData.error || chartsResponse.statusText}`)
  //     }
  //     const chartsData = await chartsResponse.json()

  //     // Get unique charts by removing duplicates
  //     const uniqueCharts = removeDuplicateCharts(chartsData.charts || [])
  //     setCharts(uniqueCharts)

  //     // Set default selected chart to the first one
  //     if (uniqueCharts.length > 0) {
  //       setSelectedChart(uniqueCharts[0].id)
  //     }

  //     setLastUpdated(new Date())
  //     setLoading(false)
  //   } catch (error) {
  //     console.error("Error fetching data:", error)
  //     setError(error instanceof Error ? error.message : "An unknown error occurred")
  //     setLoading(false)
  //   }
  // }

  // Fetch data directly from Supabase
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check rate limit
      if (!checkRateLimit()) {
        throw new Error("Rate limit exceeded. Please try again later.")
      }

      // Fetch tracks data directly from Supabase
      const { data: tracksData, error: tracksError } = await supabase.from("tracks").select("*")

      if (tracksError) {
        throw new Error(`Error fetching tracks: ${tracksError.message}`)
      }
      setTracks(tracksData || [])

      // Fetch daily snapshots data directly from Supabase
      const { data: snapshotsData, error: snapshotsError } = await supabase.from("daily_snapshots").select("*")

      if (snapshotsError) {
        throw new Error(`Error fetching snapshots: ${snapshotsError.message}`)
      }
      setDailySnapshots(snapshotsData || [])

      // Fetch charts data directly from Supabase
      const { data: chartsData, error: chartsError } = await supabase.from("charts").select("*")

      if (chartsError) {
        throw new Error(`Error fetching charts: ${chartsError.message}`)
      }

      // Get unique charts by removing duplicates
      const uniqueCharts = removeDuplicateCharts(chartsData || [])
      setCharts(uniqueCharts)

      // Set default selected chart to the first one
      if (uniqueCharts.length > 0) {
        setSelectedChart(uniqueCharts[0].id)
      }

      setLastUpdated(new Date())
      setLoading(false)
    } catch (error) {
      console.error("Error fetching data:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Simple function to remove duplicate charts based on name
  const removeDuplicateCharts = (fetchedCharts: Chart[]): Chart[] => {
    const uniqueChartMap = new Map<string, Chart>()

    // Keep only the first occurrence of each chart name
    for (const chart of fetchedCharts) {
      const chartName = chart.name.toLowerCase()
      if (!uniqueChartMap.has(chartName)) {
        uniqueChartMap.set(chartName, chart)
      }
    }

    return Array.from(uniqueChartMap.values())
  }

  // Get songs for the selected chart
  const getSongsForChart = (chartId: string): SongWithRank[] => {
    if (!chartId || !tracks.length || !dailySnapshots.length) return []

    // Find the latest date for this chart
    const latestDate = dailySnapshots
      .filter((snapshot) => snapshot.chart_id === chartId)
      .reduce((latest, snapshot) => {
        return new Date(snapshot.date_scraped) > new Date(latest) ? snapshot.date_scraped : latest
      }, "1970-01-01")

    // Get snapshots for this chart on the latest date
    const chartSnapshots = dailySnapshots.filter(
      (snapshot) => snapshot.chart_id === chartId && snapshot.date_scraped === latestDate,
    )

    // Map snapshots to tracks and ensure proper numerical sorting
    return chartSnapshots
      .map((snapshot) => {
        const track = tracks.find((t) => t.id === snapshot.track_id)
        if (!track) return null

        return {
          ...track,
          rank: snapshot.today_rank,
          previousRank: snapshot.yesterday_rank,
          trend: snapshot.trend,
          longevity: snapshot.longevity,
          chartId: snapshot.chart_id,
        }
      })
      .filter(Boolean) as SongWithRank[]
  }

  // Get historical data for a song
  const getHistoricalData = (trackId: string, chartId: string): HistoricalData[] => {
    if (!trackId || !chartId || !dailySnapshots.length) return []

    // Filter snapshots for this track and chart
    const trackSnapshots = dailySnapshots.filter(
      (snapshot) => snapshot.track_id === trackId && snapshot.chart_id === chartId,
    )

    // Sort by date
    trackSnapshots.sort((a, b) => new Date(a.date_scraped).getTime() - new Date(b.date_scraped).getTime())

    // Format for chart display with additional validation
    return trackSnapshots
      .map((snapshot) => {
        const rankValue = snapshot.today_rank ? Number.parseInt(snapshot.today_rank, 10) : null
        // Only include entries with valid rank values
        if (rankValue === null || isNaN(rankValue)) return null

        return {
          date: new Date(snapshot.date_scraped).toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          }),
          rank: rankValue,
        }
      })
      .filter((item): item is HistoricalData => item !== null)
  }

  // Add a new function to find all charts a song appears in
  const getChartsForSong = (trackId: string): Chart[] => {
    if (!trackId || !dailySnapshots.length || !charts.length) return []

    // Get unique chart IDs for this track
    const chartIds = [
      ...new Set(
        dailySnapshots.filter((snapshot) => snapshot.track_id === trackId).map((snapshot) => snapshot.chart_id),
      ),
    ]

    // Map to chart objects
    return chartIds.map((chartId) => charts.find((chart) => chart.id === chartId)).filter(Boolean) as Chart[]
  }

  // Update the handleSongClick function to find all charts the song appears in
  const handleSongClick = (song: SongWithRank) => {
    setSelectedSong(song)
    const history = getHistoricalData(song.id, song.chartId)
    setHistoricalData(history)
    setIsDialogOpen(true)
  }

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <ArrowUp className="text-green-500 h-5 w-5" />
    if (trend === "down") return <ArrowDown className="text-red-500 h-5 w-5" />
    if (trend === "new") return <Plus className="text-blue-500 h-5 w-5" />
    return <Minus className="text-yellow-500 h-5 w-5" />
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  // Format artist name - replace "/" with ", "
  const formatArtist = (artist: string) => {
    return artist.replace(/\//g, ", ")
  }

  // Format longevity with proper pluralization
  const formatLongevity = (days: string) => {
    return days === "1" ? "1 day" : `${days} days`
  }

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Get sorted and filtered songs
  const getSortedAndFilteredSongs = () => {
    const songs = selectedChart ? getSongsForChart(selectedChart) : []

    // Filter songs based on search query
    const filteredSongs =
      searchQuery.trim() === ""
        ? songs
        : songs.filter((song) => {
            const query = searchQuery.toLowerCase()
            return song.title.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query)
          })

    if (!sortColumn || !sortDirection) {
      // Default sort by rank
      return [...filteredSongs].sort((a, b) => Number(a.rank) - Number(b.rank))
    }

    return [...filteredSongs].sort((a, b) => {
      let comparison = 0

      if (sortColumn === "rank") {
        comparison = Number(a.rank) - Number(b.rank)
      } else if (sortColumn === "title") {
        comparison = a.title.localeCompare(b.title)
      } else if (sortColumn === "artist") {
        comparison = a.artist.localeCompare(b.artist)
      } else if (sortColumn === "longevity") {
        comparison = Number(a.longevity) - Number(b.longevity)
      }

      return sortDirection === "asc" ? comparison : -comparison
    })
  }

  // Get sort icon
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return null
    }

    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    )
  }

  const songsForSelectedChart = getSortedAndFilteredSongs()

  // Add scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Format time for last updated
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Handle tab scroll
  const scrollTabs = (direction: "left" | "right") => {
    if (tabsListRef.current) {
      const scrollAmount = 400 // Adjust as needed
      const currentScroll = tabsListRef.current.scrollLeft

      tabsListRef.current.scrollTo({
        left: direction === "left" ? currentScroll - scrollAmount : currentScroll + scrollAmount,
        behavior: "smooth",
      })
    }
  }

  // Refresh data from API
  // const refreshData = async () => {
  //   setLoading(true)
  //   try {
  //     // Fetch tracks data from API
  //     const tracksData = await fetchFromApi("/api/tracks")
  //     setTracks(tracksData.tracks || [])

  //     // Fetch daily snapshots data from API
  //     const snapshotsData = await fetchFromApi("/api/snapshots")
  //     setDailySnapshots(snapshotsData.snapshots || [])

  //     // Fetch charts data from API
  //     const chartsData = await fetchFromApi("/api/charts")

  //     // Get unique charts by removing duplicates
  //     const uniqueCharts = removeDuplicateCharts(chartsData.charts || [])
  //     setCharts(uniqueCharts)

  //     setLastUpdated(new Date())
  //     setError(null)
  //   } catch (error) {
  //     console.error("Error refreshing data:", error)
  //     setError(error instanceof Error ? error.message : "An unknown error occurred")
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  // Refresh data from Supabase
  const refreshData = async () => {
    setLoading(true)
    try {
      // Check rate limit
      if (!checkRateLimit()) {
        throw new Error("Rate limit exceeded. Please try again later.")
      }

      // Fetch tracks data directly from Supabase
      const { data: tracksData, error: tracksError } = await supabase.from("tracks").select("*")

      if (tracksError) {
        throw new Error(`Error fetching tracks: ${tracksError.message}`)
      }
      setTracks(tracksData || [])

      // Fetch daily snapshots data directly from Supabase
      const { data: snapshotsData, error: snapshotsError } = await supabase.from("daily_snapshots").select("*")

      if (snapshotsError) {
        throw new Error(`Error fetching snapshots: ${snapshotsError.message}`)
      }
      setDailySnapshots(snapshotsData || [])

      // Fetch charts data directly from Supabase
      const { data: chartsData, error: chartsError } = await supabase.from("charts").select("*")

      if (chartsError) {
        throw new Error(`Error fetching charts: ${chartsError.message}`)
      }

      // Get unique charts by removing duplicates
      const uniqueCharts = removeDuplicateCharts(chartsData || [])
      setCharts(uniqueCharts)

      setLastUpdated(new Date())
      setError(null)
    } catch (error) {
      console.error("Error refreshing data:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  // Validate and sanitize search query
  const validateSearchQuery = (query: string): string => {
    // Remove any potentially harmful characters and limit length
    return query
      .replace(/[^\w\s]/gi, "")
      .trim()
      .substring(0, 100)
  }

  // Export current chart to CSV
  const exportToCSV = () => {
    if (!songsForSelectedChart.length) return

    const chartName = charts.find((c) => c.id === selectedChart)?.name || "Chart"
    const filename = `${chartName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`

    // Create CSV header
    const headers = ["Rank", "Title", "Artist", "Trend", "Longevity"]

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...songsForSelectedChart.map((song) =>
        [
          song.rank,
          `"${song.title.replace(/"/g, '""')}"`, // Escape quotes in title
          `"${song.artist.replace(/"/g, '""')}"`, // Escape quotes in artist
          song.trend,
          song.longevity,
        ].join(","),
      ),
    ].join("\n")

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Clear search query
  const clearSearch = () => {
    setSearchQuery("")
  }

  // Update the rank and trend icon alignment
  const RankDisplay = ({ rank, trend }: { rank: string; trend: string }) => {
    return (
      <div className="flex items-center">
        <span className="w-8 inline-block text-right">{rank}</span>
        <span className="ml-2 flex-shrink-0 inline-flex">{getTrendIcon(trend)}</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#1a1a1a] text-white">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-[#121212]">
        <div className="container flex h-20 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center">
            <button onClick={scrollToTop} className="flex items-center transition-colors">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className="hidden font-mono text-2xl tracking-tight text-gray-400 hover:text-white transition-colors sm:inline-block select-none">
                  QQScrape
                </span>
              </div>
            </button>

            {lastUpdated && (
              <div className="hidden md:flex items-center gap-2 ml-6 text-gray-400 select-none">
                <button
                  onClick={refreshData}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                  disabled={loading}
                >
                  <div className="relative mr-1">
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </div>
                  <span className="text-xs">Updated: {formatTime(lastUpdated)}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center">
            <a
              href="https://www.linkedin.com/in/arjun-senthil-9475b119a/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2 py-1.5 rounded transition-all duration-300 hover:bg-[#222222] hover:scale-105 hover:shadow-[0_0_15px_rgba(0,119,181,0.3)]"
            >
              <span className="font-mono text-base text-gray-400 select-none">Designed by</span>
              <div className="flex items-center select-none">
                <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/arsunol%20transparent-smaller-hoeRwqHXcRhqPR53Ui5VbVwWZje0Rt.png"
                  alt="Arsunol"
                  className="h-5 opacity-90 relative -top-[2px]"
                />
              </div>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <ErrorBoundary>
          <div className="container mx-auto">
            <div className="mb-6 flex justify-between items-center">
              <div className="select-none">
                <h1 className="text-3xl font-bold tracking-tight">QQMusic Charts</h1>
                <p className="text-gray-400">View and compare data scraped from multiple QQMusic charts</p>
              </div>

              <div className="relative rounded-full bg-[#252525] px-3 py-1.5 hover:bg-[#333333] transition-colors">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(validateSearchQuery(e.target.value))}
                  placeholder="Search songs..."
                  className="bg-transparent border-none text-sm pl-6 pr-8 focus:outline-none text-gray-200 w-48 md:w-64 placeholder:select-none"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-md text-white">
                <p className="font-medium">Error loading data:</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="space-y-6">
                {/* Simple chart tabs skeleton */}
                <div className="h-12 bg-[#252525] rounded-md animate-pulse" />

                {/* Simple chart content skeleton */}
                <div className="bg-[#252525] rounded-md p-6 animate-pulse">
                  <div className="h-8 w-1/3 bg-[#333333] rounded mb-4" />
                  <div className="h-4 w-2/3 bg-[#333333] rounded mb-8" />

                  {/* Simple table skeleton */}
                  <div className="space-y-4">
                    <div className="h-8 bg-[#333333] rounded" />
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-12 bg-[#333333] rounded opacity-80" style={{ opacity: 1 - i * 0.1 }} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3 bg-[#1a1a1a] rounded-md border border-gray-800">
                  <Tabs value={selectedChart} onValueChange={setSelectedChart}>
                    <div className="flex items-center">
                      <button
                        onClick={() => scrollTabs("left")}
                        className="flex-shrink-0 h-11 w-8 flex items-center justify-center bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors rounded-l-md"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>

                      <div className="overflow-hidden" ref={tabsListRef}>
                        <TabsList className="h-11 w-max flex bg-[#1a1a1a] rounded-none">
                          {charts.map((chart) => (
                            <TabsTrigger
                              key={chart.id}
                              value={chart.id}
                              className="px-4 text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white text-gray-400 select-none"
                            >
                              {chart.name}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>

                      <button
                        onClick={() => scrollTabs("right")}
                        className="flex-shrink-0 h-11 w-8 flex items-center justify-center bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors rounded-r-md"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </Tabs>
                </div>

                <Card className="bg-[#252525] border-gray-800">
                  <CardHeader className="select-none">
                    <CardTitle className="text-white">
                      {charts.find((c) => c.id === selectedChart)?.name || "Chart"}
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Click on any song to view detailed performance statistics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {songsForSelectedChart.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-800 hover:bg-transparent">
                            <TableHead
                              className="w-[100px] text-gray-400 cursor-pointer select-none"
                              onClick={() => handleSort("rank")}
                            >
                              Rank {getSortIcon("rank")}
                            </TableHead>
                            <TableHead
                              className="text-gray-400 cursor-pointer select-none"
                              onClick={() => handleSort("title")}
                            >
                              Title {getSortIcon("title")}
                            </TableHead>
                            <TableHead
                              className="text-gray-400 cursor-pointer select-none"
                              onClick={() => handleSort("artist")}
                            >
                              Artist {getSortIcon("artist")}
                            </TableHead>
                            <TableHead
                              className="hidden md:table-cell text-gray-400 cursor-pointer select-none"
                              onClick={() => handleSort("longevity")}
                            >
                              Longevity {getSortIcon("longevity")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {songsForSelectedChart.map((song) => (
                            <TableRow
                              key={song.id}
                              className="cursor-pointer hover:bg-[#333333] border-gray-800"
                              onClick={() => handleSongClick(song)}
                            >
                              {/* Rank Column */}
                              <TableCell className="font-medium text-gray-200">
                                <RankDisplay rank={song.rank} trend={song.trend} />
                              </TableCell>

                              {/* Title Column */}
                              <TableCell className="font-medium text-gray-200">
                                <div className="flex items-center gap-2">
                                  <Play className="h-4 w-4 text-gray-400" />
                                  {song.title}
                                </div>
                              </TableCell>

                              {/* Artist Column */}
                              <TableCell className="text-gray-200">{formatArtist(song.artist)}</TableCell>

                              {/* Longevity Column */}
                              <TableCell className="hidden md:table-cell text-gray-200">
                                {formatLongevity(song.longevity)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-8 text-center text-gray-400">
                        {searchQuery ? "No songs match your search" : "No songs available for this chart"}
                      </div>
                    )}
                  </CardContent>
                  <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
                    <Button
                      onClick={exportToCSV}
                      variant="outline"
                      size="sm"
                      className="bg-[#333333] text-gray-200 border-gray-700 hover:bg-[#444444] hover:text-white select-none"
                      disabled={songsForSelectedChart.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export as CSV
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </div>
        </ErrorBoundary>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[750px] bg-[#252525] text-white border-gray-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Music className="h-5 w-5" />
              {selectedSong?.title} by {selectedSong && formatArtist(selectedSong.artist)}
            </DialogTitle>
          </DialogHeader>

          {selectedSong && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none text-gray-400">Current Rank</p>
                  <p className="text-2xl font-bold">{selectedSong.rank}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none text-gray-400">Longevity</p>
                  <p className="text-2xl font-bold">{formatLongevity(selectedSong.longevity)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none text-gray-400">Trend</p>
                  <p className="text-2xl font-bold flex items-center">
                    {getTrendIcon(selectedSong.trend)}
                    <span className="ml-2">{selectedSong.trend}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none text-gray-400">Yesterday's Rank</p>
                  <p className="text-2xl font-bold">{selectedSong.previousRank || "New"}</p>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="mb-4 text-lg font-medium text-white">Chart Performance History</h3>
                {historicalData && historicalData.length > 1 ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <SimpleChart data={historicalData} />
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400">
                    Not enough historical data available for this song
                  </div>
                )}
              </div>

              <div className="pt-2">
                <h3 className="mb-4 text-lg font-medium text-white">Song Details</h3>
                <div className="space-y-2">
                  {selectedSong.song_mid && (
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-400">Song Link:</span>
                      <a
                        href={`https://y.qq.com/m/client/music_index/index.html?ADTAG=cbshare&channelId=10036163&mid=${selectedSong.song_mid}&openinqqmusic=1&type=${selectedSong.song_mid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline text-right"
                      >
                        Open in QQ Music
                      </a>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-400">Added to Database:</span>
                    <span className="text-gray-200">{formatDate(selectedSong.created_at)}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-400">Appears in Chart(s):</span>
                    <div className="text-right">
                      {getChartsForSong(selectedSong.id).map((chart) => (
                        <div
                          key={chart.id}
                          className={chart.id === selectedSong.chartId ? "text-white font-bold" : "text-gray-200"}
                        >
                          {chart.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

