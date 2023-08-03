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


const theme = createTheme();
const normSteps = ['Submitting Recipe', 'Creating Recipe', 'Done!'];


const CreatingRecipeStepper = (props) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [recipe, setRecipe] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);

    const submitRecipe = async () => {
        const apiUrl = "https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/api";
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({ "url": props.url }),
        });

        if (!response.ok) {
            throw new Error('Request failed.');
        } else {
            handleSubmitNext();
        }
    };


    const getRecipe = async () => {
        const apiUrl = `https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/api?url=${props.url}`;
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
    };

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitForRecipe = async () => {
        let retry = true;
        const apiUrl = `https://ucowpmolm0.execute-api.us-east-1.amazonaws.com/prod/api?url=${props.url}`;
        while (retry) {
            await delay(10000);
            try {
                const response = await fetch(apiUrl, {
                    method: 'GET'
                });
        
                if (!response.ok) {
                    throw new Error('Request failed.');
                }

                const data = await response.json();
                console.log(data);
                if (Array.isArray(data) && data.length > 0) {
                    retry = false;
                    handleProcessingNext();
                }
            } catch (error) {
            console.error(error);
            }
        }
    };



    useEffect(() => {
        if (activeStep === 0 && !submitted) {
            submitRecipe();
        } else if (activeStep === 1 && processing) {
            waitForRecipe();
        } else if (activeStep === 2) {
            getRecipe();
        }
    }, [submitted, processing]);

  const handleSubmitNext = () => {
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
    console.log(step);

    switch (step) {
      case 0:
        return <CreatingRecipeStep1 step={step} url={props.url}/>
      case 1:
        return <CreatingRecipeStep2 step={step} url={props.url}/>
      case 2:
        return <CreatingRecipeStep3 step={step} url={props.url} recipe={recipe} handleClose={props.handleClose}/>
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