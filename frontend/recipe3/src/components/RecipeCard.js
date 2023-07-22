import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { List, ListItem } from '@mui/material';
import RecipeModal from './RecipeModal';

const RecipeCard = (props) => {
    const [open, setOpen] = useState(false);

    const handleView = () => {
        setOpen(true);
    }

    const handleClose = () => {
        setOpen(false);
    }
    
    return (
        <Grid item key={props.index} xs={12} sm={6}>
        <RecipeModal open={open} handleClose={handleClose} recipe={props.recipe}/>
        <Card
          sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <CardMedia
            component="div"
            sx={{
              // 16:9
              pt: '56.25%',
            }}
            image={props.recipe["image"]}
          />
          <CardContent sx={{ flexGrow: 1 }}>
            <Typography gutterBottom variant="h5" component="h2">
              {props.recipe["name"]}
            </Typography>
            <Typography>
              {props.recipe["summary"]}
            </Typography>
          </CardContent>
          <CardActions>
            {!props.noButton && <Button size="small">Mint</Button>}
            {!props.noButton && <Button onClick={handleView} size="small">View</Button>}
          </CardActions>
        </Card>
      </Grid>
    );
};

export default RecipeCard;