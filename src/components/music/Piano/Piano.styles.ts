import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    piano: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      maxHeight: '180px',
    },
  }),
);
