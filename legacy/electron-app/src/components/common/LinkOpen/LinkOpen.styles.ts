import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    linkOpen: {
      whiteSpace: 'nowrap',
      '&:hover': {
        color: theme.palette.primary.light,
      },
      '& > *': {
        fontSize: 'inherit',
        display: 'inline-block',
        verticalAlign: 'bottom',
      },
      '& svg': {
        position: 'relative',
        top: 0,
      },
    },
    icon: {
      marginLeft: '0.5em',
    },
  }),
);
