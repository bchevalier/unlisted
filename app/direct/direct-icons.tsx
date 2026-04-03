import React from 'react';

type IconProps = { size?: number; className?: string };

const d = (size: number, className: string | undefined, path: string) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={path} />
  </svg>
);

const multi = (size: number, className: string | undefined, paths: string[]) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {paths.map((p, i) => <path key={i} d={p} />)}
  </svg>
);

export function IconLock({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z',
    'M7 11V7a5 5 0 0110 0v4',
  ]);
}

export function IconClipboard({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2',
    'M15 2H9a1 1 0 00-1 1v1a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z',
  ]);
}

export function IconShield({ size = 20, className }: IconProps) {
  return d(size, className, 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
}

export function IconFilm({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M19.82 2H4.18A2.18 2.18 0 002 4.18v15.64A2.18 2.18 0 004.18 22h15.64A2.18 2.18 0 0022 19.82V4.18A2.18 2.18 0 0019.82 2z',
    'M7 2v20', 'M17 2v20', 'M2 12h20', 'M2 7h5', 'M2 17h5', 'M17 17h5', 'M17 7h5',
  ]);
}

export function IconBriefcase({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z',
    'M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16',
  ]);
}

export function IconStore({ size = 20, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

export function IconBuilding({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z',
    'M4 22v-7',
  ]);
}

export function IconPen({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M12 20h9', 'M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z',
  ]);
}

export function IconInbox({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M22 12h-6l-2 3H10l-2-3H2',
    'M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z',
  ]);
}

export function IconCode({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M16 18l6-6-6-6', 'M8 6l-6 6 6 6',
  ]);
}

export function IconHome({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
    'M9 22V12h6v10',
  ]);
}

export function IconUsers({ size = 20, className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" />
      <circle cx="17.5" cy="6.5" r="3" />
    </svg>
  );
}

export function IconHeart({ size = 20, className }: IconProps) {
  return d(size, className, 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z');
}

export function IconMic({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z',
    'M19 10v2a7 7 0 01-14 0v-2', 'M12 19v4', 'M8 23h8',
  ]);
}

export function IconMusic({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M9 18V5l12-2v13',
    'M9 18a3 3 0 11-6 0 3 3 0 016 0z',
    'M21 16a3 3 0 11-6 0 3 3 0 016 0z',
  ]);
}

export function IconActivity({ size = 20, className }: IconProps) {
  return d(size, className, 'M22 12h-4l-3 9L9 3l-3 9H2');
}

export function IconLink({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  ]);
}

export function IconEdit({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
    'M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z',
  ]);
}

export function IconZap({ size = 20, className }: IconProps) {
  return d(size, className, 'M13 2L3 14h9l-1 8 10-12h-9l1-8z');
}

export function IconEyeOff({ size = 20, className }: IconProps) {
  return multi(size, className, [
    'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94',
    'M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19',
    'M14.12 14.12a3 3 0 11-4.24-4.24',
    'M1 1l22 22',
  ]);
}

export function IconX({ size = 20, className }: IconProps) {
  return multi(size, className, ['M18 6L6 18', 'M6 6l12 12']);
}

export const ICON_MAP: Record<string, (props: IconProps) => React.JSX.Element> = {
  lock: IconLock,
  clipboard: IconClipboard,
  shield: IconShield,
  film: IconFilm,
  briefcase: IconBriefcase,
  store: IconStore,
  building: IconBuilding,
  pen: IconPen,
  inbox: IconInbox,
  code: IconCode,
  home: IconHome,
  users: IconUsers,
  heart: IconHeart,
  mic: IconMic,
  music: IconMusic,
  activity: IconActivity,
  link: IconLink,
  edit: IconEdit,
  zap: IconZap,
  'eye-off': IconEyeOff,
  x: IconX,
};

export function DirectIcon({ name, size = 20, className }: { name: string } & IconProps) {
  const Component = ICON_MAP[name];
  if (!Component) return null;
  return <Component size={size} className={className} />;
}
