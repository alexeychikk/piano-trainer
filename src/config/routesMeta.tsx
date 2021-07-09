import type React from 'react';

export type RouteMeta = {
  to: string;
  label: React.ReactNode;
  icon?: SvgComponent;
  activeOnlyWhenExact?: boolean;
  hidden?: boolean;
};

export const ROUTES_META: { [key: string]: RouteMeta } = {
  '/': {
    to: '/',
    label: 'Chords',
    activeOnlyWhenExact: true,
  },
};
