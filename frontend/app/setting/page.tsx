'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/AuthContext'

const formSchema = z.object({
  host: z.string().regex(/^https?:\/\/[a-zA-Z0-9.-]+(:\d*)?$/, {
    message:
      "Host must start with 'https://' or 'http://' and a valid domain name (e.g. example.com)."
  }),
  username: z.string().min(2, {
    message: 'Username must be at least 2 characters.'
  }),
  password: z.string().min(2, {
    message: 'Password must be at least 2 characters.'
  })
})

export default function SettingApp() {
  const [validating, setValidating] = useState(false)
  const { host, username, password, login, logout } = useAuth()
  const { toast } = useToast()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema)
  })

  // Load credential from context on mount
  useEffect(() => {
    form.reset({ host, username, password })
  }, [host, username, password, form])

  function onReset() {
    logout()
    form.reset({})
    toast({
      title: 'Logout successful!'
    })
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    toast({
      title: 'Login in progress...'
    })
    setValidating(true)
    try {
      await login(values.host, values.username, values.password)
      toast({
        title: 'Login successful!'
      })
    } catch (error) {
      toast({
        title: 'Failed to login',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      })
    } finally {
      setValidating(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col space-y-8"
      >
        <FormField
          control={form.control}
          name="host"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Host</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-x-4 self-end">
          <Button type="button" variant="destructive" onClick={onReset}>
            Reset
          </Button>
          <Button type="submit" disabled={validating}>
            {validating && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}
