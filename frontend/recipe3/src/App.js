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
              Generate a recipe NFT from your favorite recipe URL or input the old family recipe. Search through all recipes created by other users and mint your favorite today!
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
            {Object.values(recipes.get(page)).map((recipe, index) => (
              <RecipeCard recipe={recipe} index={index}/>
            ))}
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