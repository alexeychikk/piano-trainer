import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    icon: {
      width: '24px',
      height: '24px',
      marginRight: theme.spacing(1.5),
    },
    listItem: {
      padding: 0,
    },
    link: {
      width: '100%',
      padding: theme.spacing(1.5, 2),
      fontSize: theme.typography.h6.fontSize,
    },
    linkActive: {
      backgroundColor: theme.palette.action.selected,
    },
  }),
);
