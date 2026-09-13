import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    active: {},
    link: {
      padding: theme.spacing(0, 4, 0, 2),
      marginRight: '1px',
      color: theme.palette.text.secondary,
      backgroundColor: 'rgb(45,45,45)',
      '&$active': {
        backgroundColor: theme.palette.background.default,
      },
    },
  }),
);
