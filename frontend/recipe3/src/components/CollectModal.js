import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import { useSelector } from 'react-redux';


const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function CollectModal(props) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const user = useSelector(state => state.user);


  const handleClose = () => {
    setSuccess(false);
  }


  const handleSubmit = () => {
    submitMintRecipe();
  }

  const submitMintRecipe = async () => {
    const apiUrl = "https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/collect";
    setSubmitting(true);
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            "username": user.publicKey,
            "uuid": props.recipe["uuid"]
        }),
    });

    if (!response.ok) {
        console.log("Problem?");
        console.log(response);
        setSuccess(true);
        props.handleClose();
    } else {
        setSuccess(true);
        props.handleClose();
    }
};

  return (
    <div>
      <Snackbar open={success} autoHideDuration={6000} onClose={handleClose}>
        <Alert onClose={handleClose} severity="success" sx={{ width: '100%' }}>
          Successfully collected the recipe!
        </Alert>
      </Snackbar>
      <Dialog open={props.open} onClose={props.handleClose}>
        <DialogTitle>{submitting ? "Collecting" : "Collect"} Recipe</DialogTitle>
        {!submitting &&
        <DialogContent>
          <DialogContentText>
            Collect {props.recipe["name"]} and store it in your recipe book!
          </DialogContentText>
        </DialogContent>
        }
        {submitting &&
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
            <CircularProgress color="success" />
          </div>        
        }
        <DialogActions>
          <Button disabled={submitting} onClick={props.handleClose}>Cancel</Button>
          <Button disabled={submitting} onClick={handleSubmit}>{submitting ? "Collecting..." : "Collect"}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}