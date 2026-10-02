import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Google only. AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are picked up from env.
  providers: [Google],
  pages: { signIn: "/signin" },
  callbacks: {
    // Database sessions: make the user id explicit on the session object so
    // server actions can key orders off it without a second lookup.
    session({ session, user }) {
      if (session.user && user) session.user.id = user.id;
      return session;
    },
  },
});
