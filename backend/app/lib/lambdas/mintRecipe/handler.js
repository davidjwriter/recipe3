const { ethers } = require("ethers")
const fs = require("fs");
const axios = require('axios');
const { NFTStorage, File } = require("nft.storage");

/**
 * Setup all constants needed for storing the metadata
 * and minting the NFT
 */

// Our contract owner private key for minting the NFTs
const privateKey = process.env.PRIVATE_KEY || '';
// Our nft.storage api key so we can store the metadata
const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY || '';
// Our quicknode endpoint so we can interact with Polygon
const QUICKNODE_HTTP_ENDPOINT = "https://still-wider-rain.matic-testnet.discover.quiknode.pro/1dfacdd6a5fc8e2a6cac2242a9b53367a85831ad/"
const provider = new ethers.providers.JsonRpcProvider(QUICKNODE_HTTP_ENDPOINT)

// Our Polygon smart contract address and abi
const contractAddress = "0x5C6661E7A37f7E2dBb609b1C220fEe17c7da4314";
const contractAbi = fs.readFileSync(__dirname + "/abi.json").toString();
const contractInstance = new ethers.Contract(contractAddress, contractAbi, provider)

// Create our wallet for minting NFTs
const wallet = new ethers.Wallet(privateKey, provider)

/**
 * Function to retrieve image data from another URL like S3 or Arweave
 * @param {*} url of the image we want to upload using nft.storage
 * @returns 
 */
async function fetchImageFromS3(url) {
  try {
    // Fetch the image from the S3 bucket as a stream
    const response = await axios.get(url, { responseType: 'stream' });
    // Create a promise to capture the image data from the stream
    const imageData = await new Promise((resolve, reject) => {
      const chunks = [];
      response.data.on('data', (chunk) => chunks.push(chunk));
      response.data.on('end', () => resolve(Buffer.concat(chunks)));
      response.data.on('error', (error) => reject(error));
    });
    // Return the stream of the image
    return imageData;
  } catch (error) {
    console.error('Error fetching image from S3:', error);
    throw error;
  }  
}

/**
 * Uses nft.storage to upload the metadata for the given recipe NFT
 * @param {*} imageURL the url for the image we want to use with the NFT
 * @param {*} name the name of the recipe
 * @param {*} description the description of the recipe
 * @returns 
 */
async function storeAsset(imageURL, name, description) {
  const client = new NFTStorage({ token: NFT_STORAGE_API_KEY })
  const img = await fetchImageFromS3(imageURL);
  const metadata = await client.store({
      name,
      description,
      image: new File(
          [img],
          'pic.jpg',
          { type: 'image/jpg' }
      )
  })
  console.log("Metadata stored on Filecoin and IPFS with URL:", metadata.url);
  console.log(metadata);
  return metadata.url;
}

async function getGasPrice() {
    let feeData = (await provider.getGasPrice()).toNumber()
    return feeData
}

async function getNonce(signer) {
    let nonce = await provider.getTransactionCount(wallet.address)
    return nonce
}

/**
 * Mints the NFT to Polygon and sends it to the given address with given metadata
 * @param {*} address the receiver's Polygon address
 * @param {*} URI the uri of the metadata file we just created
 * @returns 
 */
async function mintNFT(address, URI) {
    try {
        const nonce = await getNonce(wallet)
        const gasFee = await getGasPrice()
        let rawTxn = await contractInstance.populateTransaction.mintNFT(address, URI, {
            gasPrice: gasFee, 
            nonce: nonce
        })
        console.log("...Submitting transaction with gas price of:", ethers.utils.formatUnits(gasFee, "gwei"), " - & nonce:", nonce)
        let signedTxn = (await wallet).sendTransaction(rawTxn)
        let reciept = (await signedTxn).wait()
        if (reciept) {
            console.log("Minted NFT Successfully!");
            return "Success";
        } else {
            console.log("Error submitting transaction")
            throw Exception("Error submitting txn")
        }
    } catch (e) {
        console.log("Error Caught in Catch Statement: ", e)
        throw e;
    }
}

const handler = async (event) => {
  if (!event.body) {
    return { statusCode: 400, header: "Access-Control-Allow-Origin: *", body: 'invalid request, you are missing the parameter body' };
  }
  const body = typeof event.body == 'object' ? event.body : JSON.parse(event.body);
  const receiver = body.receiver;
  const imageURL = body.image;
  const name = body.name;
  const description = body.description;

  // 1. First create the metadata
  let metaData = await storeAsset(imageURL, name, description);

  // 2. Take the metadata and mint a new NFT for the receiver
  try {
    await mintNFT(receiver, metaData);
    return {
      statusCode: 200, 
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: "Success!"
    };
  } catch (err) {
    return {
      statusCode: 500, 
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(err)
    };
  }
};

module.exports = {
  handler,
};