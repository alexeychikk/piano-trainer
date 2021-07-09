import { Divider, Hidden, List } from '@material-ui/core';
import { GitHub, LinkedIn, MailOutlineRounded } from '@material-ui/icons';
import React from 'react';
import { MobileDrawer } from '@src/components/MobileDrawer';
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
    <Hidden mdUp>
      <MobileDrawer
        anchor="right"
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

        <Divider />

        <List>
          <ListItemLink
            onClick={props.onClose}
            icon={GitHub}
            isExternal
            target="_blank"
            to="https://github.com/alexeychikk"
          >
            GitHub
          </ListItemLink>
          <ListItemLink
            onClick={props.onClose}
            icon={LinkedIn}
            isExternal
            target="_blank"
            to="https://www.linkedin.com/in/alex-zinkevych/"
          >
            LinkedIn
          </ListItemLink>
          <ListItemLink
            onClick={props.onClose}
            icon={MailOutlineRounded}
            isExternal
            target="_blank"
            to="mailto:alexdarkmm@gmail.com"
          >
            alexdarkmm@gmail.com
          </ListItemLink>
        </List>
      </MobileDrawer>
    </Hidden>
  );
};

export const NavigationDrawer = React.memo(NavigationDrawerBase);
