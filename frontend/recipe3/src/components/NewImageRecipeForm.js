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
import dotenv from 'dotenv';
import CloudConvert from 'cloudconvert';

dotenv.config();

export default function NewImageRecipeForm(props) {
    const [selectedImage, setSelectedImage] = useState(null); // State to store the selected image
    const [validImage, setValidImage] = useState(false);
    const [credit, setCredit] = useState(''); // State to store the credit input value
    const cloudConvert = new CloudConvert(process.env.REACT_APP_CLOUD_CONVERT_API_KEY);
    

    const convertFile = async (imageUrl) => {
      const S3_BUCKET = "recipe3stack-recipeuploads4499815a-imruc63nb0r1";
      let job = await cloudConvert.jobs.create({
        "tasks": {
          "upload": {
            "operation": "import/url",
            "url": imageUrl
            },
            "convert": {
                "operation": "convert",
                "input": [
                    "upload"
                ],
                "output_format": "png"
            },
            "s3": {
                "operation": "export/s3",
                "input": [
                    "convert"
                ],
                "bucket": S3_BUCKET,
                "region": "us-east-1",
                "access_key_id": process.env.REACT_APP_AWS_ACCESS_KEY_ID,
                "secret_access_key": process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
            }
        },
        "tag": "jobbuilder"
      });
      console.log(job);
      const myJob = await cloudConvert.jobs.wait(job.id); // Wait for job completion
      console.log(myJob);
      return "https://" + S3_BUCKET + ".s3.amazonaws.com/" + selectedImage.name.replace(".heic", ".png");
    }
    const uploadFile = async () => {
        const S3_BUCKET = "recipe3stack-recipeuploads4499815a-imruc63nb0r1";
        const REGION = "us-east-1";
    
        AWS.config.update({
          accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
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
        const url = "https://" + S3_BUCKET + ".s3.amazonaws.com/" + selectedImage.name;
        return url;
      };
  
    const handleImageUpload = (event) => {
      const imageFile = event.target.files[0];
      setSelectedImage(imageFile);
    };
  
    useEffect(() => {
      setValidImage(!!selectedImage);
    }, [selectedImage]);
  
  const submitRecipe = async () => {
    let imageUrl = await uploadFile();
    if (selectedImage.name.includes("heic")) {
      let newUrl = await convertFile(imageUrl);
      console.log(newUrl);
      props.newRecipeSubmit(newUrl, credit, "IMAGE");
    } else {
      props.newRecipeSubmit(imageUrl, credit, "IMAGE");
    }
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