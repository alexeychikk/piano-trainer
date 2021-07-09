import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    indexRoute: {
      height: '100%',
      display: 'flex',
    },
    content: {
      flexGrow: 1,
      marginLeft: '320px',
      display: 'flex',
      flexDirection: 'column',
      [theme.breakpoints.down('sm')]: {
        paddingTop: '28px', // breadcrumbs
        marginLeft: 0,
      },
    },
    routesWrapper: {
      flex: 1,
      paddingTop: theme.spacing(2),
      [theme.breakpoints.down('sm')]: {
        paddingTop: theme.spacing(1),
      },
    },
  }),
);
