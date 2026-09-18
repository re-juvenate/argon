import { AreaChart } from "@tremor/react";

interface ChartDataItem {
  date: string;
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
      className="h-80"
      data={chartdata}
      index="date"
      categories={["Throughput", "Time taken"]}
      colors={["blue", "emerald"]}
      valueFormatter={numberFormatter}
      onValueChange={(v) => console.log(v)}
    />
  );
};

export default Graph;
