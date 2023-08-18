import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import { useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import CreatingRecipeStepper from './CreatingRecipeStepper';
import { useState } from 'react';
import NewURLRecipeForm from './NewURLRecipeForm';
import NewImageRecipeForm from './NewImageRecipeForm';
import NewRawRecipeForm from './NewRawRecipeForm';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack'; // Import the Stack component
import LinkIcon from '@mui/icons-material/Link'; // Import the LinkIcon
import CloudUploadIcon from '@mui/icons-material/CloudUpload'; // Import the CloudUploadIcon
import CreateIcon from '@mui/icons-material/Create'; // Import the CreateIcon


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

export default function NewRecipeModal(props) {
    const [formID, setFormID] = useState(0);

    const handleURL = () => { setFormID(1); }
    const handleImage = () => { setFormID(2); }
    const handleRaw = () => { setFormID(3); }
    const handleBack = () => { setFormID(0); }

    const handleClose = () => {
        setFormID(0);
        props.handleClose();
    }

    return (
        <div>
      <Modal
        open={props.open}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <Typography variant="h6" component="h2" gutterBottom>
            Choose a method to create a new recipe:
          </Typography>
          {formID === 0 && (
            <Stack spacing={2} fullWidth>
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                fullWidth
                onClick={handleURL}
              >
                Recipe URL
              </Button>
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                fullWidth
                onClick={handleImage}
              >
                Upload an Image
              </Button>
              <Button
                variant="outlined"
                startIcon={<CreateIcon />}
                fullWidth
                onClick={handleRaw}
              >
                Enter Recipe Manually
              </Button>
            </Stack>
          )}
          {formID === 1 && (
            <NewURLRecipeForm
              newRecipeSubmit={props.newRecipeSubmit}
              handleClose={handleClose}
              handleBack={handleBack}    
              open={props.open}        
            />
          )}
          {formID === 2 && (
            <NewImageRecipeForm
              newRecipeSubmit={props.newRecipeSubmit}
              handleClose={handleClose}
              handleBack={handleBack}  
              open={props.open}          
            />
          )}
          {formID === 3 && (
            <NewRawRecipeForm
              newRecipeSubmit={props.newRecipeSubmit}
              handleClose={handleClose}
              handleBack={handleBack}
              open={props.open}
            />
          )}
          {formID > 0 && (
            <Button fullWidth onClick={handleBack}>
              Back
            </Button>
          )}
          <Button fullWidth sx={{mt: '15px'}} onClick={handleClose}>
            Cancel
          </Button>
        </Box>
      </Modal>
        </div>
    );
}