import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles(() =>
  createStyles({
    navigation: {
      display: 'flex',
      backgroundColor: 'rgb(37, 37, 38)',
      alignItems: 'center',
    },
  }),
);
