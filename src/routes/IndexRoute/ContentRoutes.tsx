import React, { Suspense } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import Chords from '@src/routes/Chords';

export const ContentRoutes: React.FC = () => {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route exact path="/">
          <Chords />
        </Route>
        <Route path="*">
          <Redirect to="/" />
        </Route>
      </Switch>
    </Suspense>
  );
};
