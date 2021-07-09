import React from 'react';
import { useStyles } from './Chords.styles';

export const Chords: React.FC = () => {
  const classes = useStyles();
  return <div className={classes.block}>Hello Chords</div>;
};

export default Chords;
