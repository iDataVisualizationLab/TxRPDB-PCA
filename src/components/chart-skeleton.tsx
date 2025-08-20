import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ChartSkeleton() {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle><Skeleton className="h-6 w-2/3" /></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          {/* Chart area skeleton */}
          <Skeleton className="h-full w-full" />
          
          {/* X-axis skeleton */}
          <div className="flex justify-between mt-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-12" />
            ))}
          </div>
          
          {/* Y-axis skeleton */}
          <div className="absolute top-0 left-0 h-full flex flex-col justify-between py-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-8" />
            ))}
          </div>
        </div>
        
        {/* Legend skeleton */}
        <div className="flex justify-center mt-4 space-x-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center">
              <Skeleton className="h-3 w-3 mr-2" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

