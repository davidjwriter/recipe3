import * as React from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { useEffect, useState } from 'react';
import RecipeCard from '../components/RecipeCard';
import NewURLRecipeForm from '../components/NewURLRecipeForm';
import CreatingRecipeModal from '../components/CreatingRecipeModal';
import Pagination from '@mui/material/Pagination';
import { useSelector } from 'react-redux';
import NewRecipeModal from '../components/NewRecipeModal';
import { v4 as uuidv4 } from 'uuid';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const Home = (props) => {
    const [recipes, setRecipes] = useState(new Map());
    const [newRecipe, setNewRecipe] = useState("");
    const [newRecipeOpen, setNewRecipeOpen] = useState(false);
    const [creatingRecipeOpen, setCreatingRecipeOpen] = useState(false);
  
    const handleNewRecipe = () => { setNewRecipeOpen(true); }
    const handleClose = () => { setNewRecipeOpen(false); }
    const handleCreationDone = () => { setCreatingRecipeOpen(false); }
  
    const RECIPE_PER_PAGE = 6;
    const [page, setPage] = useState(1);

    const [success, setSuccess] = useState(false);
    const [failed, setFailed] = useState(false);

    const handleSuccessClose = () => { setSuccess(false); }
    const handleFailClose = () => { setFailed(false); }

    const handleSuccess = () => { setSuccess(true); }
    const handleFailed = () => { setFailed(true); }

    const handlePageChange = (e, p) => {
        setPage(p);
      }
    
      const handleBuyMeACoffee = () => {
        window.open('https://commerce.coinbase.com/checkout/5208dfe6-1668-4636-9adc-3c435bdb674b', '_blank');
      }
    
      const newRecipeSubmit = (url, credit = '', contentType) => {
        console.log(url);
        const newUUID = uuidv4();
        setNewRecipe({
          uuid: newUUID,
          url,
          credit,
          contentType
        });
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
            <Snackbar open={success} autoHideDuration={6000} onClose={handleSuccessClose}>
              <Alert onClose={handleSuccessClose} severity="success" sx={{ width: '100%' }}>
                Successfully created the recipe!
              </Alert>
            </Snackbar>
            <Snackbar open={failed} autoHideDuration={6000} onClose={handleFailClose}>
              <Alert onClose={handleFailClose} severity="error" sx={{ width: '100%' }}>
                Could not create recipe, please try again :/
              </Alert>
            </Snackbar>
            <NewRecipeModal open={newRecipeOpen} handleClose={handleClose} newRecipeSubmit={newRecipeSubmit}/>
            <CreatingRecipeModal open={creatingRecipeOpen} newRecipe={newRecipe} handleClose={handleCreationDone} handleSuccess={handleSuccess} handleFailed={handleFailed}/>
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
                <RecipeCard recipe={recipe} index={index} showCollect={true}/>
              ))
            }
          </Grid>
        </Container>
        <Stack sx={{marginTop: '20px', alignItems: 'center', justifyItems: 'center'}} spacing={2}>
                <Pagination page={page} onChange={handlePageChange} count={recipes.size} color="primary" />
        </Stack>
      </main>
    );
};

export default Home;