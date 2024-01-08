import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { userActions } from './store/user-slice';
import Home from './pages/Home';
import User from './pages/User';
import { Routes, Route } from 'react-router-dom';
import { useNavigate } from 'react-router';
import { useAuth0 } from '@auth0/auth0-react';





function Copyright() {
  return (
    <Typography variant="body2" color="text.secondary" align="center">
      {'Copyright © '}
      <Link color="inherit" href="">
        Recipe3
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

// TODO remove, this demo shouldn't need to reset the theme.
const defaultTheme = createTheme();

export default function App() {
  const { user, loginWithRedirect, logout, isAuthenticated } = useAuth0();

  const dispatch = useDispatch();
  const myUser = useSelector(state => state.user);

  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      const {nickname} = user;
      console.log("USERNAME IS");
      console.log(nickname);
      console.log(user);
      dispatch(userActions.logIn({"publicKey": nickname}));
    }
  }, [isAuthenticated, user, dispatch])


  const navigateMyRecipes = () => {
    navigate('/myrecipes');
  }

  const navigateHome = () => {
    navigate('/');
  }

  return (
    <ThemeProvider theme={defaultTheme}>
      <CssBaseline />
      <AppBar position="relative">
      <Toolbar>
        <MenuBookIcon sx={{ mr: 2 }} />
          <Typography sx={{cursor: 'pointer'}} onClick={navigateHome} variant="h6" color="inherit" noWrap>
            Recipes
          </Typography>
          <Box sx={{ flexGrow: 1 }} /> {/* This will take up the available space */}
          {!myUser.loggedIn && <Button onClick={() => loginWithRedirect()} color="secondary" variant="contained">Login</Button>}
          {myUser.loggedIn && <Button sx={{ml: '10px'}} onClick={navigateMyRecipes} color="secondary" variant="contained">My Recipes</Button>}
          {myUser.loggedIn && <Button sx={{ml: '10px'}} onClick={logout} color="secondary" variant = "contained">Logout</Button>}
      </Toolbar>
      </AppBar>
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route path='/myrecipes' element={<User/>}/>
      </Routes>
      {/* Footer */}
      <Box sx={{ bgcolor: 'background.paper', p: 6 }} component="footer">
        <Typography variant="h6" align="center" gutterBottom>
          Recipe3
        </Typography>
        <Typography
          variant="subtitle1"
          align="center"
          color="text.secondary"
          component="p"
        >
          Food powered by AI and empowered by web3
        </Typography>
        <Copyright />
      </Box>
      {/* End footer */}
    </ThemeProvider>
  );
}