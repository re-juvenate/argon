import Layout from "./components/dash/Layout"
import Graph, { type ChartDataItem } from "./components/dash/nodeoptions/graph"
import AwsMap from "./components/dash/Map"
const App = () => {
  const mockChartData: ChartDataItem[] = [
    { time: "10:00", Throughput: 120, Time: 45 },
    { time: "10:05", Throughput: 145, Time: 42 },
    { time: "10:10", Throughput: 130, Time: 50 },
    { time: "10:15", Throughput: 165, Time: 48 },
    { time: "10:20", Throughput: 190, Time: 39 },
    { time: "10:25", Throughput: 175, Time: 41 },
    { time: "10:30", Throughput: 210, Time: 35 },
  ]

  return (
    <div className="bg-background min-h-screen w-screen">
      <Layout />
      {/*<AwsMap />*/}
      {/*<Graph chartdata={mockChartData} />*/}
    </div>
  )
}

export default App
