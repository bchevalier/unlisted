import { db } from '../../../lib/db';

export async function getKeeperSecurityProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerifiedAt: true,
      twoFactorEnabled: true
    }
  });
}
