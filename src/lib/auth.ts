import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Restrict Google account picker to SQU domain
      authorization: {
        params: {
          hd: "squ.edu.om",
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    // Verify that the user's email belongs to @squ.edu.om
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      // Allow sign-in only for SQU email addresses
      if (user.email.endsWith("@squ.edu.om")) {
        return true;
      }

      // Reject non-SQU emails — redirect to auth-error
      return "/auth-error?reason=invalid_domain";
    },

    // Pass user info to the JWT token
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      if (account && profile) {
        token.hd = (profile as Record<string, unknown>).hd as string | undefined;
      }
      return token;
    },

    // Expose user info to the client session
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/auth-error",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET,
});
