"use client"
import DatePickerWithRange from "@/components/date-range-picker"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { subDays } from "date-fns"
import { useState } from "react"
import { DateRange } from "react-day-picker"

const accounts = [
  {
    id: 1,
    name: "Wallet",
    balance: 100,
  },
  {
    id: 2,
    name: "Credit Card",
    balance: -200,
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

export default function AccountApp() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  return (
    <div className="flex h-full">
      {/* Accounts */}
      <div className="flex-1 p-4">
        <h1 className="text-lg font-semibold">Accounts</h1>
        <ul>
          <Separator className="my-2" />
          {accounts.map((account) => (
            <>
              <li key={account.id} className="text-sm">
                <div className="font-semibold">{account.name}</div>
                <div className="text-sm">
                  {account.balance > 0 ? "+" : "-"}${Math.abs(account.balance)}
                </div>
              </li>
              <Separator className="my-2" />
            </>
          ))}
        </ul>
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
