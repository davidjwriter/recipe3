import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import { useEffect, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Recipe from './Recipe';
import RecipeCard from './RecipeCard';
import CheckIcon from '@mui/icons-material/Check';

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
  };

const CreatingRecipeStep3 = (props) => {
    /**
     * Show Recipe Card, not spongebob thing
     */


    return (
        <Box sx={style}>
            <CheckIcon color="success" />

            <Typography id="modal-modal-title" variant="h6" component="h2">
                Done!
            </Typography>
            {props.recipe !== null && <RecipeCard recipe={props.recipe}/>}
            <Button onClick={props.handleClose}>Close</Button>
        </Box>
    );
};

export default CreatingRecipeStep3;