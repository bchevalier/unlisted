import { db } from '../../../lib/db';
import type { PublicDoor } from '../types';

export async function getPublicDoorBySlug(slug: string): Promise<PublicDoor | null> {
  const door = await db.door.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      displayName: true,
      headline: true,
      isEnabled: true,
      categories: {
        where: { isEnabled: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          key: true,
          label: true,
          description: true,
          fields: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              key: true,
              label: true,
              type: true,
              required: true,
              placeholder: true
            }
          }
        }
      }
    }
  });

  if (!door || !door.isEnabled) {
    return null;
  }

  return {
    id: door.id,
    slug: door.slug,
    displayName: door.displayName,
    headline: door.headline,
    categories: door.categories
  };
}
