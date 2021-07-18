import { createStyles, darken, makeStyles } from '@material-ui/core';
import { blue, indigo } from '@material-ui/core/colors';

export const useStyles = makeStyles((theme) =>
  createStyles({
    loader: {
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
    },
    childrenWrapper: {
      backgroundColor: theme.palette.background.default,
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'auto',
      animation: '$childrenAnimation 1s ease-in-out',
      animationDelay: '480ms',
      animationFillMode: 'backwards',
      zIndex: theme.zIndex.drawer + 1,
    },
    inner: {
      position: 'absolute',
      animation: '$innerLoader 1.5s ease-in-out',
      zIndex: theme.zIndex.drawer + 1,
    },
    inner1: {
      backgroundColor: darken(indigo[500], 0.7),
    },
    inner2: {
      backgroundColor: blue[300],
      animationDelay: '120ms',
    },
    inner3: {
      backgroundColor: theme.palette.background.default,
      animationDelay: '240ms',
    },
    inner4: {
      backgroundColor: darken(indigo[500], 0.25),
      animationDelay: '360ms',
    },
    '@keyframes innerLoader': {
      '0%': {
        top: '50%',
        left: '50%',
        height: '0%',
        width: '0%',
        transform: 'rotate(-90deg)',
      },
      '66%': {
        top: '-50%',
        left: '0',
        height: '200%',
        width: '100%',
        transform: 'rotate(0deg)',
      },
    },
    '@keyframes childrenAnimation': {
      '0%': {
        transform: 'rotate(-90deg) scale(0)',
      },
      '100%': {
        transform: 'rotate(0deg) scale(1)',
      },
    },
  }),
);
