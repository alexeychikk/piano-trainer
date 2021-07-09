import type { ListItemProps } from '@material-ui/core';
import { ListItem } from '@material-ui/core';
import React from 'react';
import type { NavLinkProps } from '@src/components/NavLink';
import { NavLink } from '@src/components/NavLink';
import { useStyles } from './ListItemLink.styles';

export interface ListItemLinkProps extends NavLinkProps {
  onClick?: ListItemProps<'div'>['onClick'];
}

const ListItemLinkBase: React.FC<ListItemLinkProps> = ({
  onClick,
  ...rest
}) => {
  const classes = useStyles();
  return (
    <ListItem className={classes.listItem} button onClick={onClick}>
      <NavLink
        className={classes.link}
        activeClassName={classes.linkActive}
        iconClassName={classes.icon}
        hasIcon
        {...rest}
      />
    </ListItem>
  );
};

export const ListItemLink = React.memo(ListItemLinkBase);
