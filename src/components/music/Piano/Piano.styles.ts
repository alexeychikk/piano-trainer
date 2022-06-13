import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    piano: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      maxHeight: '180px',
      minHeight: '60px',
      height: '10vw',
    },
    noteLabel: {
      textAlign: 'center',
      lineHeight: 1,
      marginBottom: theme.spacing(1),
      '&$pitchC:not($noteActive):not($noteHighlighted)': {
        color: '#555',
      },
      '&$noteHighlighted': {
        color: theme.palette.primary.main,
      },
    },
    octave: {
      fontSize: '0.7em',
    },
    noteAccidental: {},
    noteActive: {},
    noteHighlighted: {},
    pitchC: {},
  }),
);
