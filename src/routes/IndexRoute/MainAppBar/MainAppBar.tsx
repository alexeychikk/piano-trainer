import {
  AppBar,
  Hidden,
  IconButton,
  Toolbar,
  Typography,
} from '@material-ui/core';
import { Menu as MenuIcon } from '@material-ui/icons';
import React from 'react';
import { Link } from 'react-router-dom';
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
          <Hidden mdUp>
            <IconButton
              color="inherit"
              aria-label="open navigation drawer"
              onClick={props.onDrawerOpen}
            >
              <MenuIcon />
            </IconButton>
          </Hidden>
          <Typography className={classes.myName} variant="subtitle1">
            <Link to="/">Piano Trainer</Link>
          </Typography>
        </div>
        <Hidden smDown>
          <Navigation className={classes.navigation} />
        </Hidden>
      </Toolbar>
    </AppBar>
  );
};

export const MainAppBar = React.memo(MainAppBarBase);
