import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles(() =>
  createStyles({
    responsiveDrawer: {},
    drawerPaper: {
      borderRight: 'none',
      width: '320px',
    },
  }),
);
