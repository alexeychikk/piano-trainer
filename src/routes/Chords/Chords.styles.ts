import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    chords: {
      height: '100%',
      padding: theme.spacing(0, 2),
      display: 'flex',
      flexDirection: 'column',
    },
    devices: {},
    piano: {},
  }),
);
