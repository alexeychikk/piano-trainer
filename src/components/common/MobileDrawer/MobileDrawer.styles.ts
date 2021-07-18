import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    mobileDrawerPaper: {
      borderRight: 'none',
      width: '320px',
    },
    toolbar: {
      padding: theme.spacing(0, 2),
      boxShadow: theme.shadows[3],
      zIndex: theme.zIndex.drawer,
    },
  }),
);
