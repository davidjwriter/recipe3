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


  const handleNext = () => {
    console.log("Handling Next!");
    if (activeStep < 2) {
        setActiveStep((currStep) => currStep + 1);
    }
  };

  function getStepContent(step) {
    console.log(step);

    switch (step) {
      case 0:
        return <CreatingRecipeStep1 handleNext={handleNext} step={step} url={props.url}/>
      case 1:
        return <CreatingRecipeStep2 handleNext={handleNext} step={step} url={props.url}/>
      case 2:
        return <CreatingRecipeStep3 handleNext={handleNext} step={step} url={props.url}/>
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