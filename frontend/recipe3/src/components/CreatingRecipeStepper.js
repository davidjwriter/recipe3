import * as React from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { createTheme } from '@mui/material/styles';
import ShoppingCartTwoToneIcon from '@mui/icons-material/ShoppingCartTwoTone';
import Avatar from '@mui/material/Avatar';
import { useState, useEffect } from 'react';
import { Stack } from '@mui/system';
import CreatingRecipeStep1 from './CreatingRecipeStep1';
import CreatingRecipeStep2 from './CreatingRecipeStep2';
import CreatingRecipeStep3 from './CreatingRecipeStep3';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();
const theme = createTheme();
const normSteps = ['Submitting Recipe', 'Creating Recipe', 'Done!'];


const CreatingRecipeStepper = (props) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [recipe, setRecipe] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sqsUrl, setSqsUrl] = useState(null);
  const [init, setInit] = useState(false);

    const submitRecipe = async () => {
        if (!submitted) {
          const apiUrl = "https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/api";
          const body = JSON.stringify({ 
            "url": props.newRecipe["url"],
            "uuid": props.newRecipe["uuid"],
            "credit": props.newRecipe["credit"],
            "content_type": props.newRecipe["contentType"]
          });
          try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                },
                body,
            });

            if (!response.ok) {
                props.handleFailed();
                props.handleClose();
            } else {
              const responseData = await response.json();
              if (responseData.uuid !== undefined) {
                setRecipe(responseData);
              } else {
                setSqsUrl(responseData.sqs_url);
              }
              handleSubmitNext();
            }
          } catch (error) {
            console.log(error);
            props.handleFailed();
            props.handleClose();
          }
        }
    };


    const getRecipe = async () => {
      if (recipe === null) {
        const uuid = props.newRecipe['contentType'] === "URL" ? props.newRecipe["url"] : props.newRecipe["uuid"];
        const apiUrl = `https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/api?url=${uuid}`;
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
      }
    };
    const pollForMessages = (sqs) => {
      const params = {
        QueueUrl: sqsUrl,
        MaxNumberOfMessages: 1, // Adjust this as needed
        WaitTimeSeconds: 20,   // Adjust this as needed
      };
    
      sqs.receiveMessage(params, (err, data) => {
        if (err) {
          console.error('Error receiving message:', err);
          // Handle the error (e.g., show an error message)
        } else {
          const message = data.Messages && data.Messages[0];
          if (message) {
            // Handle the received message (e.g., update state)
            let data = JSON.parse(message.Body);
            console.log("Message Received: " + data.status_code);
            if (data.status_code === 500) {
              props.handleClose();
              props.handleFailed();
            } else {
              handleProcessingNext();
              props.success();
            }
            // Delete the message from the queue
            sqs.deleteMessage({
              QueueUrl: sqsUrl,
              ReceiptHandle: message.ReceiptHandle,
            }, (deleteErr) => {
              if (deleteErr) {
                console.error('Error deleting message:', deleteErr);
                // Handle the delete error
              }
            });
          }
        }
    
        // Poll for new messages again after a delay
        setTimeout(() => {
          pollForMessages(sqs);
        }, 5000); // Poll every 5 seconds
      });
    }
    const subscribeToSns = async () => {
      if (recipe !== null) {
        console.log("Recipe: " + recipe);
        handleProcessingNext();
      } else {
        AWS.config.update({
          accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
          region: 'us-east-1'
        });
        const sqs = new AWS.SQS();
        pollForMessages(sqs);
      }
    }

    useEffect(() => {
      setInit(true);
    }, []);

    useEffect(() => {
      if (init) {
        if (activeStep === 0 && !submitted) {
            submitRecipe();
        } else if (activeStep === 1 && processing) {
            subscribeToSns();
        } else if (activeStep === 2) {
            getRecipe();
        }
      }
    }, [activeStep, init]);

  const handleSubmitNext = () => {
    console.log("Handling next");
    if (!submitted) {
        setSubmitted(true);
        setProcessing(true);
        setActiveStep(1);
    }
  };

  const handleProcessingNext = () => {
    if (processing) {
        setProcessing(false);
        setActiveStep(2);
    }
  }

  function getStepContent(step) {
    switch (step) {
      case 0:
        return <CreatingRecipeStep1 step={step} newRecipe={props.newRecipe}/>
      case 1:
        return <CreatingRecipeStep2 step={step} newRecipe={props.newRecipe}/>
      case 2:
        return <CreatingRecipeStep3 step={step} newRecipe={props.newRecipe} recipe={recipe} handleClose={props.handleClose}/>
      case 3:
        return (
          <Stack sx={{
              width: {xs: '100%', sm: '50%'},
              height: {xs: '50%', sm: '25%'}
            }}>
            <Typography sx={{paddingBottom: '10px'}} variant="h5">Congratulations! You are an official Spatium author!</Typography>
            <Typography sx={{paddingTop: '10px'}} variant="p">Refresh this page to publish your story!</Typography>
          </Stack>
        );
      default:
        throw new Error('Unknown step');
    }
  }

  return (
    <Box
    sx={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    }}> 
          <React.Fragment>
              <React.Fragment>
                {getStepContent(activeStep)}
              </React.Fragment>
          </React.Fragment>
      </Box>
  );
};

export default CreatingRecipeStepper;