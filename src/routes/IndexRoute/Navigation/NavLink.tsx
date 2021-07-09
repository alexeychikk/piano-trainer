import { Typography } from '@material-ui/core';
import React from 'react';
import { NavLink as BaseNavLink } from '@src/components/NavLink';
import { useStyles } from './NavLink.styles';

interface NavLinkProps {
  to: string;
  activeOnlyWhenExact?: boolean;
  icon?: SvgComponent;
}

export const NavLink: React.FC<NavLinkProps> = (props) => {
  const classes = useStyles();

  return (
    <BaseNavLink
      className={classes.link}
      activeClassName={classes.active}
      hasIcon
      {...props}
    >
      <Typography variant="body1">{props.children}</Typography>
    </BaseNavLink>
  );
};
