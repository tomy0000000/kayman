import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  className?: string
  children: React.ReactNode
}

export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  className,
  children
}: ResponsiveSheetProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    // Modal here: the drawer covers most of the viewport, so there is nothing
    // useful left to reach behind it.
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className={className}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
    )
  }

  // Non-modal here so the table behind stays clickable while the form is open.
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className={cn('flex flex-col', className)}
        onFocusOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
