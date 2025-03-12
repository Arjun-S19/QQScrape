export function rateLimit({ interval, uniqueTokenPerInterval }: { interval: number; uniqueTokenPerInterval: number }) {
  const tokenCache = new Map()

  return {
    check: async (NextResponse: any, limit: number, token: string) => {
      const tokenCount = tokenCache.get(token) || [0]
      if (tokenCount[0] === 0) {
        tokenCache.set(token, tokenCount)
      }

      tokenCount[0] += 1

      const currentUsage = tokenCount[0]
      const isRateLimited = currentUsage >= limit

      // Reset the token count after the interval
      setTimeout(() => {
        tokenCache.delete(token)
      }, interval)

      if (isRateLimited) {
        throw new Error("Rate limit exceeded")
      }

      return true
    },
  }
}

