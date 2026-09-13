import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    midiDevices: {
      overflow: 'hidden',
    },
    list: {
      '$connected &': {
        padding: 0,
      },
    },
    midiInput: {},
    subheader: {
      display: 'flex',
      alignItems: 'center',
    },
    deviceCount: {
      marginLeft: '1em',
      color: theme.palette.text.primary,
    },
    refreshButton: {
      marginLeft: theme.spacing(2),
    },
    connected: {},
  }),
);
