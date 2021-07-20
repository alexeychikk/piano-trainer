import { Toolbar } from '@material-ui/core';
import React, { useCallback, useState } from 'react';
import { MidiConnection } from '@src/components/music/MidiConnection';
import { ContentRoutes } from './ContentRoutes';
import { useStyles } from './IndexRoute.styles';
import { MainAppBar } from './MainAppBar';
import { NavigationDrawer } from './NavigationDrawer';

export const IndexRoute: React.FC = () => {
  const classes = useStyles();

  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <div className={classes.indexRoute}>
      <MainAppBar onDrawerOpen={openDrawer} />

      <NavigationDrawer
        open={isDrawerOpen}
        onOpen={openDrawer}
        onClose={closeDrawer}
      />

      <MidiConnection />

      <div className={classes.content}>
        <Toolbar /> {/* For proper top gap */}
        <div className={classes.routesWrapper}>
          <ContentRoutes />
        </div>
      </div>
    </div>
  );
};

export default IndexRoute;
