import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    instrumentSelect: {},
    innerSelect: {
      padding: theme.spacing(1),
    },
  }),
);
