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
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'center',
      lineHeight: 1,
      height: '100%',
      paddingBottom: theme.spacing(1),
      '&$pitchC:not($noteActive):not($noteHighlighted)': {
        color: '#555',
      },
      '&:not($pitchC):not($noteAccidental):not($noteActive):not($noteHighlighted)':
        {
          color: '#999',
        },
      '&$noteHighlighted': {
        backgroundColor: theme.palette.primary.main,
        '&$noteActive': {
          backgroundColor: theme.palette.primary.light,
        },
        '&$noteAccidental': {
          backgroundColor: theme.palette.secondary.dark,
          '&$noteActive': {
            backgroundColor: theme.palette.secondary.main,
          },
        },
      },
    },
    labelSpacing: {
      flex: 1,
    },
    pitch: {},
    octave: {
      fontSize: '0.7em',
    },
    noteAccidental: {},
    noteActive: {},
    noteHighlighted: {},
    pitchC: {
      fontWeight: 'bold',
    },
  }),
);
