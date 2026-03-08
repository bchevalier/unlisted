export type PublicDoorField = {
  key: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'URL' | 'EMAIL';
  required: boolean;
  placeholder: string | null;
};

export type PublicDoorCategory = {
  key: string;
  label: string;
  description: string | null;
  fields: PublicDoorField[];
};

export type PublicDoor = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  categories: PublicDoorCategory[];
};
