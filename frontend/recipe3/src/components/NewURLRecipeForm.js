import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useEffect, useState } from 'react';

export default function NewURLRecipeForm(props) {
  const [url, setUrl] = useState(''); // State to store the URL input value
  const [validUrl, setIsValidUrl] = useState(false);
  const handleUrlChange = (event) => {
    setUrl(event.target.value); // Update the state with the input value
  };

  useEffect(() => {
    // Regular expression for URL validation
    const urlPattern = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
    setIsValidUrl(urlPattern.test(url));
  }, [url]);


  const handleSubmit = () => {
    props.newRecipeSubmit(url);
  }
  return (
    <div>
      <Dialog open={props.open} onClose={props.handleClose}>
        <DialogTitle>New Recipe</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Enter your recipe url and we'll import, format, and create the recipe for you to collect!
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="URL"
            type="url"
            fullWidth
            variant="standard"
            onChange={handleUrlChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={props.handleClose}>Cancel</Button>
          <Button disables={!validUrl} onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}