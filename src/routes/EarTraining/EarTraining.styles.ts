import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    earTraining: {
      height: '100%',
      padding: theme.spacing(0, 2),
      display: 'flex',
      flexDirection: 'column',
    },
    newNoteButton: {},
    buttonsWrapper: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      '& > *': {
        flex: 1,
      },
    },
  }),
);
