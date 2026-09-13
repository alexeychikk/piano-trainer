import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    noteSelect: {
      minWidth: '180px',
    },
    innerSelect: {
      padding: theme.spacing(1),
    },
  }),
);
