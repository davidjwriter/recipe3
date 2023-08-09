import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { List, ListItem } from '@mui/material';
import RecipeCard from './components/RecipeCard';
import NewURLRecipeForm from './components/NewURLRecipeForm';
import CreatingRecipeModal from './components/CreatingRecipeModal';
import Pagination from '@mui/material/Pagination';
import { Web3Auth } from "@web3auth/web3auth";
import Web3 from "web3";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import RPC from "./web3RPC";
import { useSelector, useDispatch } from 'react-redux';
import { userActions } from './store/user-slice';




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
  const [recipes, setRecipes] = useState(new Map());
  const [url, setUrl] = useState("");
  const [newRecipeOpen, setNewRecipeOpen] = useState(false);
  const [creatingRecipeOpen, setCreatingRecipeOpen] = useState(false);

  const handleNewRecipe = () => { setNewRecipeOpen(true); }
  const handleClose = () => { setNewRecipeOpen(false); }
  const handleCreationDone = () => { setCreatingRecipeOpen(false); }

  const RECIPE_PER_PAGE = 6;
  const [page, setPage] = useState(1);

  const clientId = "BI7xpIodiQQObdUMmpKq6nHgQPGfGVHWVNQ3upknWeB1mLED11GRJ7sC5Jju-9T4Hri7hNt6_nZ4he_ExmanbWU";
  const [web3auth, setWeb3auth] = useState(null);

  const dispatch = useDispatch();
  const user = useSelector(state => state.user);

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

  useEffect(() => {
    console.log(user);
  }, [user]);

  const handlePageChange = (e, p) => {
    setPage(p);
  }

  const handleBuyMeACoffee = () => {
    window.open('https://commerce.coinbase.com/checkout/5208dfe6-1668-4636-9adc-3c435bdb674b', '_blank');
  }

  const newRecipeSubmit = (url) => {
    console.log(url);
    setUrl(url);
    setNewRecipeOpen(false);
    setCreatingRecipeOpen(true);
  }

  const formatAddress = (address) => {
    return address.slice(0, 6) + "..." + address.slice(-4);
  }

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const response = await fetch('https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/api', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
        });
        const jsonData = await response.json();
        console.log(paginateList(jsonData));
        setRecipes(paginateList(jsonData));
      } catch (error) {
        console.log('Error fetching recipes:', error);
      }
    };
    fetchRecipes();
  }, []);

  const paginateList = (list) => {
    list.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    console.log(list);
    let data = new Map();
    let i = 0;
    let pageNum = 1;
    list.map((recipe) => {
        i += 1;
        if (data.get(pageNum) === undefined) {
            data.set(pageNum, [recipe]);
        } else {
            data.set(pageNum, [...data.get(pageNum), recipe]);
        }
        if (i === RECIPE_PER_PAGE) {
            pageNum += 1;
            i = 0;
        }
    });
    return data;
  }

  return (
    <ThemeProvider theme={defaultTheme}>
      <CssBaseline />
      <AppBar position="relative">
      <Toolbar>
        <MenuBookIcon sx={{ mr: 2 }} />
          <Typography variant="h6" color="inherit" noWrap>
            Recipes
          </Typography>
          <Box sx={{ flexGrow: 1 }} /> {/* This will take up the available space */}
          {!user.loggedIn && <Button onClick={login} color="secondary" variant="contained">Login</Button>}
          {user.loggedIn && <Typography variant="p">{formatAddress(user.publicKey)}</Typography>}
          {user.loggedIn && <Button sx={{ml: '10px'}} onClick={logout} color="secondary" variant = "contained">Logout</Button>}
      </Toolbar>
      </AppBar>
      <main>
        {/* Hero unit */}
        <Box
          sx={{
            bgcolor: 'background.paper',
            pt: 8,
            pb: 6,
          }}
        >
          <Container maxWidth="sm">
            <NewURLRecipeForm open={newRecipeOpen} handleClose={handleClose} newRecipeSubmit={newRecipeSubmit}/>
            <CreatingRecipeModal open={creatingRecipeOpen} url={url} handleClose={handleCreationDone}/>
            <Typography
              component="h1"
              variant="h2"
              align="center"
              color="text.primary"
              gutterBottom
            >
              Recipe3
            </Typography>
            <Typography variant="h5" align="center" color="text.secondary" paragraph>
              Generate a recipe NFT from your favorite recipe URL or input the old family recipe. Search through all recipes created by other users and collect your favorite today!
            </Typography>
            <Stack
              sx={{ pt: 4 }}
              direction="row"
              spacing={2}
              justifyContent="center"
            >
              <Button onClick={handleNewRecipe} variant="contained">Create New Recipe!</Button>
              <Button onClick={handleBuyMeACoffee} variant="outlined">Buy Me a Coffee</Button>
            </Stack>
          </Container>
        </Box>
        <Container sx={{ py: 8 }} maxWidth="md">
          {/* End hero unit */}
          <Grid container spacing={4}>
            {recipes.size > 0 &&
              Object.values(recipes.get(page)).map((recipe, index) => (
                <RecipeCard recipe={recipe} index={index}/>
              ))
            }
          </Grid>
        </Container>
        <Stack sx={{marginTop: '20px', alignItems: 'center', justifyItems: 'center'}} spacing={2}>
                <Pagination page={page} onChange={handlePageChange} count={recipes.size} color="primary" />
        </Stack>
      </main>
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