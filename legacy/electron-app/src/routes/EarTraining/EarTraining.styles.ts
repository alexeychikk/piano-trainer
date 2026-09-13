import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    earTraining: {
      height: '100%',
      padding: theme.spacing(0, 2),
      display: 'flex',
      flexDirection: 'column',
    },
    formWrapper: {
      marginTop: theme.spacing(3),
    },
    selectsWrapper: {
      marginBottom: theme.spacing(1),
      '& > *:first-child': {
        marginRight: theme.spacing(2),
      },
    },
    buttonsWrapper: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      maxWidth: '500px',
      marginTop: theme.spacing(2),
      '& > *': {
        flex: 1,
      },
    },
    playNoteButton: {
      marginRight: theme.spacing(2),
    },
    newNoteButton: {},
  }),
);
