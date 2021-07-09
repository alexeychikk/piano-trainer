import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    appBar: {
      zIndex: theme.zIndex.drawer + 1,
    },
    toolbar: {
      padding: 0,
    },
    headingWrapper: {
      boxShadow: theme.shadows[3],
      display: 'flex',
      alignItems: 'center',
      color: '#fff',
      lineHeight: 1,
      textTransform: 'uppercase',
      paddingLeft: theme.spacing(2.5),
      backgroundColor: theme.palette.background.paper,
      height: '46px',
      width: '320px',
      flexShrink: 0,
      '& a': {
        color: '#fff',
        textDecoration: 'none',
      },
      [theme.breakpoints.down('sm')]: {
        boxShadow: 'none',
        backgroundColor: 'rgb(37, 37, 38)',
        width: '100%',
        paddingLeft: '5px',
      },
    },
    folderIcon: {
      width: '46px',
      height: '46px',
      padding: '11px',
      marginRight: '5px',
    },
    myName: {
      marginRight: 'auto',
      fontWeight: 700,
    },
    navigation: {
      flex: 1,
      alignSelf: 'stretch',
    },
    mobileBreadcrumbs: {
      boxShadow: theme.shadows[3],
    },
  }),
);
