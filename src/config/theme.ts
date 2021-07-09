import { createTheme } from '@material-ui/core/styles';
import createBreakpoints from '@material-ui/core/styles/createBreakpoints';
import createPalette from '@material-ui/core/styles/createPalette';

const palette = createPalette({
  divider: '#585858',
  primary: {
    main: '#cc7832',
    light: '#ffc66d',
  },
  secondary: {
    main: '#9876aa',
    light: '#6a8759',
  },
  text: {
    primary: '#cccccc',
    secondary: 'rgba(255,255,255,0.5)',
  },
  background: {
    default: '#212122',
    paper: '#1e1e1f',
  },
  type: 'dark',
});

const breakpoints = createBreakpoints({});

export const THEME = createTheme({
  palette,
  breakpoints,
  typography: {
    fontFamily: 'Segoe WPC,Segoe UI,sans-serif,Roboto',
  },
  overrides: {
    MuiCssBaseline: {
      '@global': {
        html: {
          height: '100%',
          minWidth: '320px',
        },
        body: {
          height: '100%',
        },
        '#root': {
          height: '100%',
        },

        '::-webkit-scrollbar': {
          width: '12px',
        },
        '::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '::-webkit-scrollbar-thumb': {
          background: '#79797966',
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: '#646464b3',
        },
      },
    },
    MuiAppBar: {
      colorPrimary: {
        backgroundColor: palette.background.default,
      },
    },
    MuiToolbar: {
      regular: {
        minHeight: '46px',
        [breakpoints.up('xs')]: {
          minHeight: '46px',
        },
      },
    },
    MuiBreadcrumbs: {
      separator: {
        marginLeft: 0,
        marginRight: 0,
        padding: 2,
      },
    },
  },
});
