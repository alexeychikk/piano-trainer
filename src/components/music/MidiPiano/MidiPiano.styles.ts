import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    midiPiano: {},
    inputReady: {},
    devices: {
      '$inputReady &': {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      },
    },
    piano: {},
    instrumentSelect: {
      minWidth: '180px',
    },
    pianoActions: {
      borderRadius: 0,
      padding: theme.spacing(1),
      '& > *': {
        marginRight: theme.spacing(2),
      },
    },
  }),
);
