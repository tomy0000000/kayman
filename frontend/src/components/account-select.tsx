import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item'
import { type AccountRead, readAccounts } from '@/lib/client'
import type { Client } from '@/lib/client/client'

interface AccountSelectProps {
  client: Client
  value: AccountRead | null
  onValueChange: (account: AccountRead) => void
  id?: string
}

interface AccountItemProps {
  account: AccountRead
  className?: string
}

export function AccountSelect({
  client,
  value,
  onValueChange,
  id
}: AccountSelectProps) {
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await readAccounts({ client })
      if (response.error) throw new Error('Failed to fetch accounts')
      if (!response.data) throw new Error('No data returned')
      return response.data
    }
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="h-auto w-full justify-between gap-2 px-2 py-1.5"
        >
          {value ? (
            <AccountItem account={value} className="w-full p-0" />
          ) : (
            <span className="text-muted-foreground">Select account</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width)"
      >
        {accounts?.map((account) => (
          <DropdownMenuItem
            key={account.id}
            className="p-0"
            onSelect={() => onValueChange(account)}
          >
            <AccountItem account={account} className="w-full p-2" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountItem({ account, className }: AccountItemProps) {
  return (
    <Item size="sm" className={className}>
      <ItemMedia>
        {/* TODO: account avatar */}
        <div className="size-8 shrink-0 rounded-md bg-muted" />
      </ItemMedia>
      <ItemContent className="gap-0.5">
        <ItemTitle>{account.name}</ItemTitle>
        <ItemDescription>{account.currency_code}</ItemDescription>
      </ItemContent>
    </Item>
  )
}
