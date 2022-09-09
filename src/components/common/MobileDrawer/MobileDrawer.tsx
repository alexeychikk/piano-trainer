import type { SwipeableDrawerProps } from '@material-ui/core';
import { Button, SwipeableDrawer, Toolbar } from '@material-ui/core';
import { ArrowBackIos } from '@material-ui/icons';
import clsx from 'clsx';
import React, { useMemo } from 'react';
import { useStyles } from './MobileDrawer.styles';

export interface MobileDrawerProps {
  anchor?: SwipeableDrawerProps['anchor'];
  children: React.ReactNode;
  className?: string;
  hasBackButton?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = (props) => {
  const classes = useStyles();
  const drawerClasses = useMemo(
    () => ({ paper: clsx(classes.mobileDrawerPaper, props.className) }),
    [classes],
  );

  return (
    <SwipeableDrawer
      classes={drawerClasses}
      variant="temporary"
      open={props.open}
      onOpen={props.onOpen}
      onClose={props.onClose}
      ModalProps={{
        keepMounted: true,
      }}
      anchor={props.anchor}
    >
      {props.hasBackButton && (
        <Toolbar className={classes.toolbar}>
          <Button startIcon={<ArrowBackIos />} onClick={props.onClose}>
            Back
          </Button>
        </Toolbar>
      )}
      {props.children}
    </SwipeableDrawer>
  );
};

MobileDrawer.defaultProps = {
  hasBackButton: true,
};
