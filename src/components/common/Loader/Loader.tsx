import clsx from 'clsx';
import React from 'react';
import { useStyles } from './Loader.styles';

interface LoaderProps {
  className?: string;
}

export const Loader: React.FC<LoaderProps> = (props) => {
  const classes = useStyles(props);

  return (
    <div className={clsx(classes.loader, props.className)}>
      <div className={clsx(classes.inner, classes.inner1)} />
      <div className={clsx(classes.inner, classes.inner2)} />
      <div className={clsx(classes.inner, classes.inner3)} />
      <div className={clsx(classes.inner, classes.inner4)} />
      <div className={classes.childrenWrapper}>{props.children}</div>
    </div>
  );
};
