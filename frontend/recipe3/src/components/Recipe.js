import { Container } from "@mui/system";
import Grid from '@mui/material/Grid';
import { Card, CardMedia, CardContent, CardActions } from "@mui/material";
import Pagination from '@mui/material/Pagination';
import { Typography } from "@mui/material";
import { Button } from "@mui/material";
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import React from 'react';
import RecipeCard from "./RecipeCard";

const Recipe = (props) => {
    const isValidUrl = (string) => {
        const urlPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
        return urlPattern.test(string);
    }
    const getCredit = (recipe) => {
        if (isValidUrl(recipe["uuid"])) {
            return recipe["uuid"];
        } else {
            return recipe["credit"];
        }
    }

    return (
        <React.Fragment>
            <Box
                sx={{
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
                {props.recipe["name"]}
                </Typography>
                <Typography variant="h5" align="center" color="text.secondary" paragraph>
                    by {getCredit(props.recipe)}
                </Typography>
            </Container>
            </Box>
            <Container sx={{ py: 8 }} maxWidth="lg">
            <Stack
                alignItems="center"
                spacing={2}
                sx={{paddingTop:'50px'}}
            >
            </Stack>
            <Grid container spacing={4}>
                    <RecipeCard recipe={props.recipe} index={0}/>
            </Grid>
            </Container>
        </React.Fragment>
    );
};

export default Recipe;