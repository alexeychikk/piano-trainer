import { Drawer, Hidden } from '@material-ui/core';
import clsx from 'clsx';
import React, { useMemo } from 'react';
import { MobileDrawer } from '@src/components/common/MobileDrawer';
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
  const drawerClasses = useMemo(
    () => ({ paper: classes.drawerPaper }),
    [classes],
  );

  return (
    <nav className={clsx(classes.responsiveDrawer, props.className)}>
      <Hidden smUp>
        <MobileDrawer
          open={props.isMobileOpen}
          onOpen={props.onMobileOpen}
          onClose={props.onMobileClose}
        >
          {props.children}
        </MobileDrawer>
      </Hidden>

      <Hidden xsDown implementation="css">
        <Drawer classes={drawerClasses} variant="permanent" open>
          {props.children}
        </Drawer>
      </Hidden>
    </nav>
  );
};

export const ResponsiveDrawer = React.memo(ResponsiveDrawerBase);
