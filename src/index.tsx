import ReactDOM from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App';
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { BrowserRouter } from "react-router-dom";

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

export const theme = createTheme({ 
  palette: { mode: "dark" }, 
  components: {
    MuiCssBaseline: {
      styleOverrides: (themeParam) => ({
        a: { textDecoration: 'none !important' }
      })
    }
  } 
});

root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ThemeProvider>
);
