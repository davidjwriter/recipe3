import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import { useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';

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

const CreatingRecipeStep1 = (props) => {

    /**
     * Create useEffect that publishes recipe
     */

    return (
        <Box sx={style}>
            <CircularProgress color="success" />

            <Typography id="modal-modal-title" variant="h6" component="h2">
                Submitting Recipe...
            </Typography>
            <iframe src="https://giphy.com/embed/3ohryiYkE0DVwdLAys" width="100%" height="100%" frameBorder="0" class="giphy-embed" allowFullScreen></iframe>
        </Box>
    );
};

export default CreatingRecipeStep1;