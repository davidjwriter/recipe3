import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import RecipeCard from '../components/RecipeCard';
import { useSelector } from 'react-redux';
import Pagination from '@mui/material/Pagination';



const User = (props) => {
  const [recipes, setRecipes] = useState([]); // Update state to an array
  const [page, setPage] = useState(1);
  const RECIPE_PER_PAGE = 6;

  const handlePageChange = (e, p) => {
    setPage(p);
  }

  const user = useSelector(state => state.user);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const username = user.publicKey;
        const url = `https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/collect/?username=${username}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
        });
        const jsonData = await response.json();
        setRecipes(paginateList(jsonData));
      } catch (error) {
        console.log('Error fetching recipes:', error);
      }
    };
    fetchRecipes();
  }, [user.publicKey]);

  const paginateList = (list) => {
    list.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
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
        <Box
          sx={{
            bgcolor: 'background.paper',
            pt: 8,
            pb: 6,
          }}
        >
          <Container maxWidth="sm">
            <Typography
              component="h1"
              variant="h2"
              align="center"
              color="text.primary"
              gutterBottom
            >
              {user.publicKey}'s recipes
            </Typography>
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

export default User;
