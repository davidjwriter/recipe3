import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
    name: 'user',
    initialState: { 
        loggedIn: false,
        publicKey: "",
        web3Auth: null,
    },
    reducers: {
        logIn(state, action) {
            state.loggedIn = true;
            state.publicKey = action.payload.publicKey;
        },
        logOut(state) {
            state.loggedIn = false;
            state.publicKey = "";
        },
        setWeb3Auth(state, action) {
            state.web3Auth = action.payload.web3Auth;
        }
    }
});

export const userActions = userSlice.actions;
export default userSlice;