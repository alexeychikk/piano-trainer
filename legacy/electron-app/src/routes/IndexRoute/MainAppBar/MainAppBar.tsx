import { AppBar, Hidden, IconButton, Toolbar } from '@material-ui/core';
import { Menu as MenuIcon } from '@material-ui/icons';
import React from 'react';
import { Navigation } from '../Navigation';
import { useStyles } from './MainAppBar.styles';

export interface MainAppBarProps {
  className?: string;
  onDrawerOpen: () => void;
}

const MainAppBarBase: React.FC<MainAppBarProps> = (props) => {
  const classes = useStyles();

  return (
    <AppBar position="fixed" className={classes.appBar} elevation={0}>
      <Toolbar className={classes.toolbar}>
        <div className={classes.headingWrapper}>
          <Hidden smUp>
            <IconButton
              color="inherit"
              aria-label="open navigation drawer"
              onClick={props.onDrawerOpen}
            >
              <MenuIcon />
            </IconButton>
          </Hidden>
        </div>
        <Hidden xsDown>
          <Navigation className={classes.navigation} />
        </Hidden>
      </Toolbar>
    </AppBar>
  );
};

export const MainAppBar = React.memo(MainAppBarBase);
