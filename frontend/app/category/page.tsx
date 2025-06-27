"use client"
import DatePickerWithRange from "@/components/date-range-picker"
import Tree from "@/components/tree"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { TreeItem } from "@/lib/types"
import { subDays } from "date-fns"
import { useState } from "react"
import { DateRange } from "react-day-picker"

const categories: TreeItem[] = [
  {
    id: "1",
    label: "Food",
    children: [
      { id: "1.1", label: "Breakfast" },
      { id: "1.2", label: "Lunch" },
      {
        id: "1.3",
        label: "Diner",
        children: [
          { id: "1.3.1", label: "MRT" },
          { id: "1.3.2", label: "Bus" },
        ],
      },
    ],
  },
  {
    id: "2",
    label: "Transport",
    children: [
      { id: "2.1", label: "MRT" },
      { id: "2.2", label: "Bus" },
    ],
  },
]

const transations = [
  {
    title: "Payment 1",
    date: new Date("2024-12-30"),
    amount: 100,
  },
  {
    title: "Payment 2",
    date: new Date("2025-01-02"),
    amount: -200,
  },
]

export default function CategoryApp() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  return (
    <div className="flex h-full">
      {/* Categories */}
      <div className="flex-1 p-4">
        <Tree treeData={categories} />
      </div>

      <Separator orientation="vertical" />

      {/* Transations */}
      <div className="flex-1 p-4">
        <ScrollArea className="h-full w-full rounded-md">
          <DatePickerWithRange date={date} setDate={setDate} className="mb-4" />
          {transations.map((transation) => (
            <>
              <div key={transation.title} className="text-sm">
                <div className="font-semibold">{transation.title}</div>
                <div className="text-neutral-500">
                  {transation.date.toLocaleDateString()}
                </div>
                <div className="text-sm">
                  {transation.amount > 0 ? "+" : "-"}$
                  {Math.abs(transation.amount)}
                </div>
              </div>
              <Separator className="my-2" />
            </>
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}
