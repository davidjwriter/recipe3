import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useEffect, useState } from 'react';
import AWS from 'aws-sdk';


export default function NewImageRecipeForm(props) {
    const [selectedImage, setSelectedImage] = useState(null); // State to store the selected image
    const [validImage, setValidImage] = useState(false);
    const [credit, setCredit] = useState(''); // State to store the credit input value

    const uploadFile = async () => {
        const S3_BUCKET = "recipe3stack-recipeuploads4499815a-imruc63nb0r1";
        const REGION = "us-east-1";
    
        AWS.config.update({
          accessKeyId: "AKIA5LXGPHZFX7FEBM2H",
          secretAccessKey: "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",
        });
        const s3 = new AWS.S3({
          params: { Bucket: S3_BUCKET },
          region: REGION,
        });
    
        const params = {
          Bucket: S3_BUCKET,
          Key: selectedImage.name,
          Body: selectedImage,
        };
    
        var upload = s3
          .putObject(params)
          .on("httpUploadProgress", (evt) => {
            console.log(
              "Uploading " + parseInt((evt.loaded * 100) / evt.total) + "%"
            );
          })
          .promise();
    
        await upload.then((err, data) => {
          console.log(data);
          console.log(err);
        });
        return "https://" + S3_BUCKET + ".s3.amazonaws.com/" + selectedImage.name;
      };
  
    const handleImageUpload = (event) => {
      const imageFile = event.target.files[0];
      setSelectedImage(imageFile);
    };
  
    useEffect(() => {
      setValidImage(!!selectedImage);
    }, [selectedImage]);
  
  const submitRecipe = async () => {
    const imageUrl = await uploadFile();
    console.log(imageUrl);
    props.newRecipeSubmit(imageUrl, credit, "IMAGE");
  }

  const handleSubmit = () => {
    submitRecipe();
  }
  return (
    <div>
      <Dialog open={props.open} onClose={props.handleClose}>
        <DialogTitle>New Recipe</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Upload an image of your recipe and we'll analyze, import, format, and create the recipe for you to collect!
          </DialogContentText>
          <TextField
            label="Author"
            fullWidth
            margin="normal"
            value={credit}
            onChange={(event) => setCredit(event.target.value)}
            helperText="The author/creator of the recipe"
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ marginTop: '25px' }}
          />
          </DialogContent>
        <DialogActions>
          <Button onClick={props.handleBack}>Back</Button>
          <Button onClick={props.handleClose}>Cancel</Button>
          <Button disables={!validImage} onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}