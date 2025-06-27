"use client"
import DatePickerWithRange from "@/components/date-range-picker"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { readAccounts } from "@/lib/client"
import { useAuth } from "@/lib/context/AuthContext"
import { useQuery } from "@tanstack/react-query"
import { subDays } from "date-fns"
import { useEffect, useState } from "react"
import { DateRange } from "react-day-picker"

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
  const { client } = useAuth()
  const { toast } = useToast()
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  const {
    isPending,
    isError,
    data: accounts,
    error,
  } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      if (!client) {
        throw new Error("Not login yet")
      }
      const response = await readAccounts({ client })
      if (response.error) {
        throw new Error("Failed to fetch accounts")
      }
      if (!response.data) {
        throw new Error("No data returned")
      }
      return response.data
    },
  })

  useEffect(() => {
    if (isError) {
      console.error(error)
      toast({
        title: "Failed to fetch accounts",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    }
  }, [isError, error, toast])

  return (
    <ResizablePanelGroup direction="horizontal">
      {/* Accounts */}
      <ResizablePanel>
        <ScrollArea className="h-full">
          <h1 className="text-lg font-semibold">Accounts</h1>
          <ul>
            <Separator className="my-2" />
            {accounts?.map((account) => (
              <>
                <li key={account.id} className="text-sm">
                  <div className="font-semibold">{account.name}</div>
                  <div className="text-sm">{account.balance}</div>
                </li>
                <Separator className="my-2" />
              </>
            ))}
          </ul>
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        {/* Transations */}
        <div className="flex-1 p-4">
          <ScrollArea className="h-full w-full rounded-md">
            <DatePickerWithRange
              date={date}
              setDate={setDate}
              className="mb-4"
            />
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
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
