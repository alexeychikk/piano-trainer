import { Drawer, Hidden } from '@material-ui/core';
import clsx from 'clsx';
import React from 'react';
import { MobileDrawer } from '@src/components/MobileDrawer';
import { useStyles } from './ResponsiveDrawer.styles';

export interface ResponsiveDrawerProps {
  children: React.ReactNode;
  className?: string;
  isMobileOpen: boolean;
  onMobileOpen: () => void;
  onMobileClose: () => void;
}

const ResponsiveDrawerBase: React.FC<ResponsiveDrawerProps> = (props) => {
  const classes = useStyles();

  return (
    <nav className={clsx(classes.responsiveDrawer, props.className)}>
      <Hidden mdUp>
        <MobileDrawer
          open={props.isMobileOpen}
          onOpen={props.onMobileOpen}
          onClose={props.onMobileClose}
        >
          {props.children}
        </MobileDrawer>
      </Hidden>

      <Hidden smDown implementation="css">
        <Drawer
          classes={{
            paper: classes.drawerPaper,
          }}
          variant="permanent"
          open
        >
          {props.children}
        </Drawer>
      </Hidden>
    </nav>
  );
};

export const ResponsiveDrawer = React.memo(ResponsiveDrawerBase);
