import { PrismaAdapter } from '@auth/prisma-adapter';
import { verify } from 'argon2';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { z } from 'zod';

import { db } from './db';
import { env } from './env';

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8)
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: 'database' },
  pages: {
    signIn: '/auth/login'
  },
  providers: [
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          return null;
        }

        try {
          const isValid = await verify(user.passwordHash, password);
          if (!isValid) {
            return null;
          }
        } catch {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    })
  ],
  callbacks: {
    session: async ({ session, user }) => {
      if (session.user && user) {
        session.user.id = user.id;
      }

      return session;
    }
  }
};

export const getServerAuthSession = () => getServerSession(authOptions);
