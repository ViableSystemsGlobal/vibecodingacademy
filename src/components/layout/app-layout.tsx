"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { MainLayout } from "./main-layout"
import { LoadingBar } from "@/components/ui/loading-bar"
import { useLoading } from "@/contexts/loading-context"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const { isLoading } = useLoading()
  const [isRouteChanging, setIsRouteChanging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isShopDomain, setIsShopDomain] = useState(false)
  
  // Detect if we're on shop domain/port (only on client after mount)
  useEffect(() => {
    setMounted(true)
    
    if (typeof window === 'undefined') return
    
    const hostname = window.location.hostname
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
    const isAdminDomain = hostname.includes('sms.') || hostname.includes('admin.')
    const adminPorts = new Set(['3001', '3003'])
    const isAdminPort = adminPorts.has(port)
    setIsShopDomain(port === '3000' || (!isAdminDomain && !isAdminPort))
  }, [])
  
  // Show loading bar on route changes
  useEffect(() => {
    setIsRouteChanging(true)
    const timer = setTimeout(() => {
      setIsRouteChanging(false)
    }, 500) // Show for 500ms on route change
    
    return () => clearTimeout(timer)
  }, [pathname])
  
  // Don't show admin layout on:
  // - Auth pages
  // - Shop pages (/shop/*, /blog/*)
  // - Root path (/) when on shop domain (only after mounted)
  const shopRoutePrefixes = ['/shop', '/blog']
  const isShopRoute =
    shopRoutePrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    (pathname === '/' && mounted && isShopDomain)
  const isAuthRoute = pathname.startsWith('/auth/')
  
  // Before mounted, assume we're not on shop domain to match server render
  // This prevents hydration mismatch
  if (!mounted) {
    // On server or initial render, check if it's a shop route (without domain check)
    if (pathname.startsWith('/shop') || pathname.startsWith('/blog') || isAuthRoute) {
      return <>{children}</>
    }
    // For root path, always skip admin layout on initial render
    // The page itself will handle whether to show shop or admin content
    if (pathname === '/') {
      return <>{children}</>
    }
    // For other routes, show admin layout
    return (
      <>
        <LoadingBar isLoading={isLoading || isRouteChanging} />
        <MainLayout>{children}</MainLayout>
      </>
    )
  }
  
  // After mounting, check if we should skip admin layout
  if (isAuthRoute || isShopRoute) {
    return <>{children}</>
  }
  
  // Show admin layout for all other pages (dashboard, CRM, etc.)
  return (
    <>
      <LoadingBar isLoading={isLoading || isRouteChanging} />
      <MainLayout>{children}</MainLayout>
    </>
  )
}
