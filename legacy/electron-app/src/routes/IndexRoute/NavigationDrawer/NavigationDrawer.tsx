import { Hidden, List } from '@material-ui/core';
import React from 'react';
import { MobileDrawer } from '@src/components/common/MobileDrawer';
import { useRoutesMeta } from '@src/hooks';
import { ListItemLink } from './ListItemLink';

interface NavigationDrawerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const NavigationDrawerBase: React.FC<NavigationDrawerProps> = (props) => {
  const routes = useRoutesMeta();

  return (
    <Hidden smUp>
      <MobileDrawer
        anchor="left"
        open={props.open}
        onOpen={props.onOpen}
        onClose={props.onClose}
      >
        <List>
          {routes.map(({ label, ...rest }) => (
            <ListItemLink key={rest.to} onClick={props.onClose} {...rest}>
              {label}
            </ListItemLink>
          ))}
        </List>
      </MobileDrawer>
    </Hidden>
  );
};

export const NavigationDrawer = React.memo(NavigationDrawerBase);
