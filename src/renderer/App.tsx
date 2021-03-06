import { CssBaseline, MuiThemeProvider } from '@material-ui/core';
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { MidiProvider } from '@src/components/providers/MidiProvider';
import { THEME } from '@src/config/theme';
import { IndexRoute } from '@src/routes';

export const App: React.FC = () => (
  <MuiThemeProvider theme={THEME}>
    <CssBaseline />
    <Router>
      <MidiProvider>
        <IndexRoute />
      </MidiProvider>
    </Router>
  </MuiThemeProvider>
);
