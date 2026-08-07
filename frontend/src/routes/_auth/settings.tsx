import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/settings')({
  component: SettingsPage
})

function SettingsPage() {
  return (
    <div className="w-full p-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      <p className="text-muted-foreground mt-2 text-sm">Nothing here yet.</p>
    </div>
  )
}
