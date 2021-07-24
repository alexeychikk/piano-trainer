import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles(() =>
  createStyles({
    midiWizard: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '6em',
    },
  }),
);
