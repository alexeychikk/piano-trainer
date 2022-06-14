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
    pianoActions: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 0,
      padding: theme.spacing(1),
      '& > *': {
        marginRight: theme.spacing(2),
      },
    },
    instrumentSelect: {
      minWidth: '180px',
    },
    volumeSlider: {
      flex: 1,
      maxWidth: '250px',
    },
  }),
);
