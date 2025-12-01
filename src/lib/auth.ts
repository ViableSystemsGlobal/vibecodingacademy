import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || 'adpools-secret-key-2024-production-change-me',
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Check against the database
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            }
          })

          if (!user) {
            return null
          }

          // Check if user is active
          if (!(user as any).isActive) {
            console.log('User account is inactive:', credentials.email)
            return null
          }

          // Verify password using bcrypt
          if (!user.password) {
            console.log('User has no password set:', credentials.email)
            return null
          }
          
          const isValidPassword = await bcrypt.compare(credentials.password, user.password)
          if (isValidPassword) {
            // Update last login
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() }
            })

            // Note: Login notifications and history are handled by the custom login API
            // This NextAuth authorize function doesn't have access to request headers
            // So we rely on the custom login API to handle notifications

            return {
              id: user.id,
              email: user.email,
              name: user.name || "User",
              role: user.role,
              image: user.image || null,
            }
          }

          return null
        } catch (error) {
          console.error("Authentication error:", error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial login - set token from user
      if (user) {
        token.id = user.id
        token.role = user.role
        token.image = (user as any).image || null
        return token
      }

      // On subsequent requests, refresh role and image from database
      // This ensures role and image changes are reflected without requiring re-login
      if (token?.id) {
        try {
          // First, check UserRoleAssignment to get the primary role
          const userRoleAssignments = await prisma.userRoleAssignment.findMany({
            where: {
              userId: token.id as string,
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            },
            include: {
              role: {
                select: { name: true }
              }
            },
            orderBy: { assignedAt: 'asc' }, // Get first assigned role as primary
            take: 1
          })

          let currentRole: string | null = null

          // ALWAYS prioritize UserRoleAssignment over User.role
          // If user has role assignments, use the first one
          if (userRoleAssignments.length > 0) {
            const roleName = userRoleAssignments[0].role.name
            console.log(`🔍 JWT: Found role assignment: "${roleName}" for user ${token.id}`)
            
            // For custom roles, use the role name as-is (don't try to map to enum)
            // This ensures "Test Role" stays as "Test Role", not mapped to an enum
            currentRole = roleName
            console.log(`🔍 JWT: Using role name "${roleName}" for session`)
          } else {
            // Only fallback to User.role if no role assignments exist
            console.log(`🔍 JWT: No role assignments found, falling back to User.role`)
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, image: true }
            })
            currentRole = dbUser?.role || null
            // Update image from database
            if (dbUser) {
              token.image = dbUser.image || null
            }
            console.log(`🔍 JWT: User.role fallback: ${currentRole}`)
          }
          
          // Always update token role to ensure it's current
          // This ensures role changes are reflected immediately
          if (currentRole) {
            if (currentRole !== token.role) {
              console.log(`🔄 JWT: Role updated: ${token.role} -> ${currentRole}`)
            } else {
              console.log(`✅ JWT: Role unchanged: ${currentRole}`)
            }
            token.role = currentRole
          } else {
            console.warn(`⚠️ JWT: No role found for user ${token.id}, keeping existing role: ${token.role}`)
          }

          // Refresh image from database if not already set
          if (!token.image) {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { image: true }
            })
            if (dbUser) {
              token.image = dbUser.image || null
            }
          }
        } catch (error) {
          console.error("❌ JWT: Error refreshing user role:", error)
          // Continue with existing token role on error
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        ;(session.user as any).image = token.image as string | null
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin",
  },
  events: {
    async signOut({ token }) {
      // Log signout for debugging
      console.log('User signed out:', token?.email);
    }
  }
}