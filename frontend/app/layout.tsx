"use client"
import AppSidebar from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/lib/context/AuthContext"
import { cn } from "@/lib/utils"
import "@primer/primitives/dist/css/functional/themes/light.css"
import { BaseStyles, ThemeProvider } from "@primer/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import "./globals.css"

const queryClient = new QueryClient()

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <main>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemeProvider>
                <BaseStyles>
                  <div
                    className={cn(
                      "rounded-md flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-800 w-full flex-1 overflow-hidden h-screen"
                    )}
                  >
                    <AppSidebar />
                    <div className="container mx-auto bg-white h-full p-4">
                      {children}
                    </div>
                  </div>
                </BaseStyles>
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </main>
        <Toaster />
      </body>
    </html>
  )
}
