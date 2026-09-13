import clsx from 'clsx';
import React from 'react';
import { useRoutesMeta } from '@src/hooks';
import { NavLink } from './NavLink';
import { useStyles } from './Navigation.styles';

interface NavigationProps {
  className?: string;
}

const NavigationBase: React.FC<NavigationProps> = (props) => {
  const classes = useStyles();
  const routes = useRoutesMeta();

  return (
    <div className={clsx(classes.navigation, props.className)}>
      {routes.map((route) => (
        <NavLink
          key={route.to}
          to={route.to}
          icon={route.icon}
          activeOnlyWhenExact={route.activeOnlyWhenExact}
        >
          {route.label}
        </NavLink>
      ))}
    </div>
  );
};

export const Navigation = React.memo(NavigationBase);
