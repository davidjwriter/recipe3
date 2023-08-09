import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import ListItemText from '@mui/material/ListItemText';
import ListItem from '@mui/material/ListItem';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import Slide from '@mui/material/Slide';
import Grid from '@mui/material/Grid';
import RecipeCard from './RecipeCard';
import ListItemIcon from '@mui/material/ListItemIcon';
import CircleIcon from '@mui/icons-material/Circle';



const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function RecipeModal(props) {

  return (
    <div>
      <Dialog
        fullScreen
        open={props.open}
        onClose={props.handleClose}
        TransitionComponent={Transition}
      >
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={props.handleClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              {props.recipe["name"]}
            </Typography>
            <Button autoFocus color="inherit" onClick={props.handleClose}>
              Collect
            </Button>
          </Toolbar>
        </AppBar>
        <Grid container sx={{p: 10}}>
          <Grid item xs={12} sm={6}>
            <RecipeCard recipe={props.recipe} index={0} noButton={true}/>
            <Typography sx={{pt: 3}} variant="h5">Original Recipe</Typography>
            <Typography variant="h6"><a href={props.recipe["uuid"]}>{props.recipe["uuid"]}</a></Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="h2">Ingredients</Typography>
            <List>
              {props.recipe["ingredients"].map((ingredient, index) => {
                return (
                  <ListItem key={index}>
                    <ListItemIcon><CircleIcon/></ListItemIcon>
                    <ListItemText>{ingredient}</ListItemText>
                  </ListItem>
                );              
              })}
            </List>
            <Typography variant="h2">Instructions</Typography>
            <List>
              {props.recipe["instructions"].map((instruction, index) => {
                return (
                  <ListItem key={index}>
                    <ListItemIcon><CircleIcon/></ListItemIcon>
                    <ListItemText>{instruction}</ListItemText>
                  </ListItem>
                );
              })}
            </List>
            <Typography variant="h2">Notes</Typography>
            <Typography variant="p">{props.recipe["notes"]}</Typography>
          </Grid>
        </Grid>
      </Dialog>
    </div>
  );
}