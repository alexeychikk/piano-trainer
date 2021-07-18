import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    active: {},
    link: {
      display: 'flex',
      alignSelf: 'stretch',
      alignItems: 'center',
      flexShrink: 0,
      textDecoration: 'none',
      color: theme.palette.text.primary,
      '&$active': {
        color: '#fff',
      },
    },
    icon: {
      height: '20px',
      width: '20px',
      marginRight: theme.spacing(1),
    },
  }),
);
