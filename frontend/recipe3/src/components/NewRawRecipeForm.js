import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useEffect, useState } from 'react';

export default function NewRawRecipeForm(props) {
  const [text, setText] = useState(''); // State to store the URL input value
  const [validText, setIsValidText] = useState(false);
  const [credit, setCredit] = useState('');
  const handleTextChange = (event) => {
    setText(event.target.value); // Update the state with the input value
  };

  useEffect(() => {
    // Regular expression for URL validation
    setIsValidText(text.length > 0);
  }, [text]);


  const handleSubmit = () => {
    props.newRecipeSubmit(text, credit, "BULK");
  }
  return (
    <div>
      <Dialog open={props.open} onClose={props.handleClose}>
        <DialogTitle>New Recipe</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Enter your recipe, don't worry about formatting it. We'll import, format, and create the recipe for you to collect!
          </DialogContentText>
          <TextField
            label="Author"
            fullWidth
            margin="normal"
            value={credit}
            onChange={(event) => setCredit(event.target.value)}
            helperText="The author/creator of the recipe"
          />
          <TextField
          sx={{mt: '15px'}}
          id="standard-multiline-static"
          label="Recipe"
          multiline
          rows={4}
          fullWidth
          onChange={handleTextChange}
        />
        </DialogContent>
        <DialogActions>
          <Button onClick={props.handleBack}>Back</Button>
          <Button onClick={props.handleClose}>Cancel</Button>
          <Button disables={!validText} onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}