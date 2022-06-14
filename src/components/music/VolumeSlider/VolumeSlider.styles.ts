import { createStyles, makeStyles } from '@material-ui/core';

export const useStyles = makeStyles((theme) =>
  createStyles({
    volumeSlider: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: '120px',
    },
    icon: {
      marginRight: theme.spacing(1),
    },
    slider: {},
  }),
);
