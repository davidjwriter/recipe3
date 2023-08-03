async function deployContract() {
    const RecipeNFT = await ethers.getContractFactory("RecipeNFT")
    const recipeNFT = await RecipeNFT.deploy()
    await recipeNFT.deployed()
    // This solves the bug in Mumbai network where the contract address is not the real one
    const txHash = recipeNFT.deployTransaction.hash
    const txReceipt = await ethers.provider.waitForTransaction(txHash)
    const contractAddress = txReceipt.contractAddress
    console.log("Contract deployed to address:", contractAddress)
   }
   
   deployContract()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });