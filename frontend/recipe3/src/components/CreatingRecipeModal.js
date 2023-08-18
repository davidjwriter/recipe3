import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import { useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import CreatingRecipeStepper from './CreatingRecipeStepper';


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

export default function CreatingRecipeModal(props) {

    return (
    <div>
        <Modal
        open={props.open}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
        >
            <CreatingRecipeStepper handleClose={props.handleClose} newRecipe={props.newRecipe}/>
        </Modal>
    </div>
    );
}