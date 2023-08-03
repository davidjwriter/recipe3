import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export default function NewURLRecipeForm(props) {
  const [url, setUrl] = React.useState(''); // State to store the URL input value

  const handleUrlChange = (event) => {
    setUrl(event.target.value); // Update the state with the input value
  };
  const handleSubmit = () => {
    props.newRecipeSubmit(url);
  }
  return (
    <div>
      <Dialog open={props.open} onClose={props.handleClose}>
        <DialogTitle>New Recipe</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Enter your recipe url and we'll import, format, and create the recipe for you to mint to your wallet!
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
          <Button onClick={handleSubmit}>Subscribe</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}