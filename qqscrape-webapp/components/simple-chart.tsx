"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ChartPoint {
  date: string;
  rank: number;
}

interface SimpleChartProps {
  data: ChartPoint[];
}

export function SimpleChart({ data }: SimpleChartProps) {
  if (!data || data.length < 2) {
    return <div className="py-8 text-center text-gray-400">Not enough historical data available for this song</div>;
  }

  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const minRank = Math.min(...sortedData.map((d) => d.rank));
  const maxRank = Math.max(...sortedData.map((d) => d.rank));

  const paddedMinRank = Math.max(1, minRank - 1);
  const paddedMaxRank = maxRank + 1;

  return (
    <div className="w-full bg-[#1a1a1a] rounded-lg p-4 border border-gray-800 h-[300px] relative">
      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 text-gray-400 text-med">
        Date
      </div>

      <div className="absolute top-1/2 left-1 transform -translate-y-1/2 -rotate-90 text-gray-400 text-med">
        Rank
      </div>

      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sortedData} margin={{ top: 20, right: 20, left: 5, bottom: 15 }}>
            {/* Grid */}
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

            <XAxis
              dataKey="date"
              stroke="#aaa"
              tick={{ fontSize: 12, fill: "#aaa" }}
              tickLine={false}
              axisLine={{ stroke: "#555" }}
              dy={5}
            />

            <YAxis
              domain={[paddedMaxRank, paddedMinRank]}
              reversed
              allowDecimals={false}
              stroke="#aaa"
              tick={{ fontSize: 12, fill: "#aaa" }}
              tickFormatter={(rank) => `${rank}`}
              tickLine={false}
              axisLine={{ stroke: "#555" }}
              dx={-10}
            />

            <Tooltip
              wrapperStyle={{
                zIndex: 100,
                backgroundColor: "#000",
                borderRadius: "5px",
                padding: "1px",
                color: "#fff",
                opacity: "85%",
              }}
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  const { date, rank } = payload[0].payload;
                  return (
                    <div className="text-white text-xs px-3 py-2 rounded shadow-md">
                      <div>Date: {date}</div>
                      <div>Rank: #{rank}</div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Line
              type="monotone"
              dataKey="rank"
              stroke="#ffffff"
              strokeWidth={2}
              dot={{ r: 5, fill: "#ffffff", stroke: "#333", strokeWidth: 1 }}
              activeDot={{
                r: 7,
                fill: "#ffffff",
                stroke: "#000",
                strokeWidth: 2,
              }}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

