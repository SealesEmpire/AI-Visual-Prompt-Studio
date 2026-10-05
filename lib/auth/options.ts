import "server-only";
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }));
}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(GitHubProvider({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }));
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  callbacks: {
    async session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: { signIn: "/settings" },
};
