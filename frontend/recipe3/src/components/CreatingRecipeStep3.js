import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import { useEffect, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Recipe from './Recipe';

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
    const [recipe, setRecipe] = useState(null);
    /**
     * Show Recipe Card, not spongebob thing
     */
    useEffect(() => {
        const waitForRecipe = async () => {
            const apiUrl = `https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/api?url=${props.url}`;
            try {
                const response = await fetch(apiUrl, {
                    method: 'GET'
                });
        
                if (!response.ok) {
                    throw new Error('Request failed.');
                }

                const data = await response.json();
                console.log(data);
                setRecipe(data[0]);
            } catch (error) {
            console.error(error);
            }
            props.handleNext();
        };
        waitForRecipe();
    }, [props.url]);


    return (
        <Box sx={style}>
            <CircularProgress color="success" />

            <Typography id="modal-modal-title" variant="h6" component="h2">
                Done!
            </Typography>
            {recipe !== null && <Recipe recipe={recipe}/>}
        </Box>
    );
};

export default CreatingRecipeStep3;