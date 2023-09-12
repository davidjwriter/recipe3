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
import { useEffect, useState } from 'react';
import { Web3Auth } from "@web3auth/web3auth";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import RPC from "./web3RPC";
import { useSelector, useDispatch } from 'react-redux';
import { userActions } from './store/user-slice';
import Home from './pages/Home';
import User from './pages/User';
import { Routes, Route } from 'react-router-dom';
import { useNavigate } from 'react-router';





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

  // const clientId = "BI7xpIodiQQObdUMmpKq6nHgQPGfGVHWVNQ3upknWeB1mLED11GRJ7sC5Jju-9T4Hri7hNt6_nZ4he_ExmanbWU";
  const clientId = "BEGQSzVP1hQq_TWWAB4jHasLGHfFnfU2FGlC3Sxm98lQMRUZz3FfrkqIM5arSIwW3hLlFowHDBi5ryKi4ZI1TAk";
  const [web3auth, setWeb3auth] = useState(null);

  const dispatch = useDispatch();
  const user = useSelector(state => state.user);

  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      try {
        const web3auth = new Web3Auth({
          clientId,
          chainConfig: {
            chainNamespace: CHAIN_NAMESPACES.EIP155,
            chainId: "0x13881",
            rpcTarget: "https://rpc-mumbai.maticvigil.com/",
          },
          web3AuthNetwork: "mainnet"
        });

        setWeb3auth(web3auth);
        await web3auth.initModal();
      } catch (error) {
        console.error(error);
      }
    };

    init();
  }, []);

  const login = async () => {
    if (!web3auth) {
      console.log("web3auth not initialized yet");
      return;
    }
    const web3authProvider = await web3auth.connect();
    const rpc = new RPC(web3authProvider);
    const address = await rpc.getAccounts();
    console.log(address);
    dispatch(userActions.logIn({"publicKey": address}));
  };

  const logout = async () => {
    if (!web3auth) {
      console.log("web3auth not initialized yet");
      return;
    }
    dispatch(userActions.logOut());
    web3auth.logout();
  };

  const navigateMyRecipes = () => {
    navigate('/myrecipes');
  }

  const navigateHome = () => {
    navigate('/');
  }

  useEffect(() => {
    console.log(user);
  }, [user]);

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
          {!user.loggedIn && <Button onClick={login} color="secondary" variant="contained">Login</Button>}
          {user.loggedIn && <Button sx={{ml: '10px'}} onClick={navigateMyRecipes} color="secondary" variant="contained">My Recipes</Button>}
          {user.loggedIn && <Button sx={{ml: '10px'}} onClick={logout} color="secondary" variant = "contained">Logout</Button>}
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