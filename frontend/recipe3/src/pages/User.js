import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import RecipeCard from '../components/RecipeCard';
import Pagination from '@mui/material/Pagination';
import { useSelector } from 'react-redux';
import Web3 from 'web3'; // Import the web3 library
import contractABI from '../abi.json';
import { Network, Alchemy } from 'alchemy-sdk';


const User = (props) => {
  const [recipes, setRecipes] = useState([]); // Update state to an array
  const [page, setPage] = useState(1);

  const user = useSelector(state => state.user);
  const contractAddress = '0x5C6661E7A37f7E2dBb609b1C220fEe17c7da4314'; // The address of your NFT contract
  const web3 = new Web3('https://rpc-mumbai.maticvigil.com/'); // Connect to the Polygon network using its RPC URL

  const config = {
    apiKey: "YTW8OowJW2gqX2_ElxmB_d5Lv8QP5_Wn",
    network: Network.MATIC_MUMBAI,
  };
  const alchemy = new Alchemy(config);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        // Contract address
        const address = "0x5C6661E7A37f7E2dBb609b1C220fEe17c7da4314".toUpperCase();

        const nftsForOwner = await alchemy.nft.getNftsForOwner(user.publicKey);
        const nfts = nftsForOwner.ownedNfts;

        const recipes = nfts.filter(nft => nft['contract']['address'].toUpperCase() === address).map(nft => {
            return {
                image: nft["media"][0]["gateway"],
                name: nft["title"],
                ...parseMarkdownToJSON(nft["description"])
            };
        });
        console.log(recipes);
        setRecipes(recipes);
        // console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.log('Error fetching recipes:', error);
      }
    };

    fetchRecipes();
  }, [user.publicKey]);

  const parseMarkdownToJSON = (markdown) => {
    const lines = markdown.split('\n');
    const json = {
        summary: "",
        ingredients: [],
        instructions: [],
        notes: ""
    };
    let currentSection = "";

    for (let line of lines) {
        if (line.startsWith("## ")) {
            currentSection = line.substring(3).toLowerCase();
        } else {
            if (currentSection === "description") {
                json.summary += line.trim();
            } else if (currentSection === "ingredients" || currentSection === "instructions") {
                const subIndex = currentSection === "ingredients" ? 2 : 3;
                if (line.trim() !== "") {
                    json[currentSection].push(line.trim().substring(subIndex));
                }
            } else if (currentSection === "notes") {
                json.notes += line.trim();
            }
        }
    }

    json.summary = json.summary.trim();
    json.notes = json.notes.trim();

    return json;
}
const formatAddress = (address) => {
    return address.slice(0, 6) + "..." + address.slice(-4);
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
              {formatAddress(user.publicKey)}'s recipes
            </Typography>
          </Container>
        </Box>
      <Container sx={{ py: 8 }} maxWidth="md">
        {/* End hero unit */}
        <Grid container spacing={4}>
          {recipes.map((recipe, index) => (
            <RecipeCard key={index} recipe={recipe} index={index} showCollect={false}/>
          ))}
        </Grid>
      </Container>
      {/* ... pagination ... */}
    </main>
  );
};

export default User;
