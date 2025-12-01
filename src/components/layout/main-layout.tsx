"use client"

import { useState, useEffect, memo } from "react"
import Sidebar from "./sidebar"
import { Header } from "./header"
import { FloatingChatButton } from "@/components/floating-chat-button"
import { MobileMenuProvider, useMobileMenu } from "@/contexts/mobile-menu-context"

interface MainLayoutProps {
  children: React.ReactNode
}

// Memoize Sidebar to prevent re-renders
const MemoizedSidebar = memo(Sidebar);

// Memoize Header to prevent re-renders
const MemoizedHeader = memo(Header);

function MainLayoutContent({ children }: MainLayoutProps) {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useMobileMenu()
  const [chatBg, setChatBg] = useState("");

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('chatButtonBg');
    if (saved) setChatBg(saved);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobileMenuOpen]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - hidden on mobile, shown as drawer */}
      <div className="hidden lg:block">
      <MemoizedSidebar />
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Mobile Sidebar Drawer */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:hidden
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <MemoizedSidebar onClose={() => setIsMobileMenuOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden w-full lg:w-auto">
        <MemoizedHeader />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
      <FloatingChatButton customBackground={chatBg} />
    </div>
  )
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <MobileMenuProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </MobileMenuProvider>
  )
}
