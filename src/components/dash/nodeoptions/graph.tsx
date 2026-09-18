import { AreaChart } from "@tremor/react";

interface ChartDataItem {
  time: string;
  Throughput: number;
  "Time taken": number;
}

interface GraphProps {
  chartdata: ChartDataItem[];
}

const Graph = ({ chartdata }: GraphProps) => {
  const numberFormatter = (number: number) => {
    return Intl.NumberFormat("en-US").format(number);
  };

  return (
    <AreaChart
      className="h-80 fill-white text-white"
      data={chartdata}
      index="time"
      categories={["Throughput", "Time taken"]}
      colors={["blue", "emerald"]}
      valueFormatter={numberFormatter}
      onValueChange={(v) => console.log(v)}
    />
  );
};

export default Graph;
