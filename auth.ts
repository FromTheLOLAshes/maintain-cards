import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "User ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials || credentials.username !== process.env.AUTH_USERNAME || credentials.password !== process.env.AUTH_PASSWORD) return null;
        return { id: credentials.username, name: credentials.username };
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
};
