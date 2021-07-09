import clsx from 'clsx';
import React from 'react';
import type { LinkProps } from 'react-router-dom';
import { Link, useRouteMatch } from 'react-router-dom';
import JsonIcon from '@src/assets/icons/json.svg';
import { useStyles } from './NavLink.styles';

export interface NavLinkProps {
  activeClassName?: string;
  activeOnlyWhenExact?: boolean;
  children: React.ReactNode;
  className?: string;
  hasIcon?: boolean;
  icon?: SvgComponent;
  iconClassName?: string;
  isExternal?: boolean;
  to: string;
  target?: LinkProps['target'];
}

const DefaultIcon: React.FC<{ className: string }> = (props) => (
  <img src={JsonIcon} {...props} />
);

const NavLinkBase: React.FC<NavLinkProps> = (props) => {
  const classes = useStyles();
  const match = useRouteMatch({
    path: props.to,
    exact: props.activeOnlyWhenExact,
  });
  const Icon = props.icon || DefaultIcon;
  const Component = props.isExternal ? 'a' : Link;

  return (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    <Component
      className={clsx(
        classes.link,
        match && classes.active,
        match && props.activeClassName,
        props.className,
      )}
      target={props.target}
      {...(props.isExternal ? { href: props.to } : { to: props.to })}
    >
      {props.hasIcon && (
        <Icon className={clsx(classes.icon, props.iconClassName)} />
      )}
      {props.children}
    </Component>
  );
};

export const NavLink = React.memo(NavLinkBase);
