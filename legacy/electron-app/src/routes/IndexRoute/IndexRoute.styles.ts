import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    indexRoute: {
      height: '100%',
      display: 'flex',
    },
    content: {
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    },
    routesWrapper: {
      flex: 1,
      paddingTop: theme.spacing(2),
      [theme.breakpoints.down('xs')]: {
        paddingTop: theme.spacing(1),
      },
    },
  }),
);
