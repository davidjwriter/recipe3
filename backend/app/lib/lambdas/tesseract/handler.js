const {getTextFromImage, isSupportedFile} = require('@shelf/aws-lambda-tesseract');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

  function getImageExtension(url) {
    // Use the path module to extract the file extension from the URL
    const ext = path.extname(url).toLowerCase();
    
    // Remove the leading dot from the extension, if present
    return ext.replace(/^\./, '');
  }
  
  async function generateUUID() {
    // Generate a UUID using the uuid library
    return uuidv4();
  }
const handler = async (event) => {
    if (!event.body) {
      return { statusCode: 400, header: "Access-Control-Allow-Origin: *", body: 'invalid request, you are missing the parameter body' };
    }
    const body = typeof event.body == 'object' ? event.body : JSON.parse(event.body);
    console.log(body);
    const imageURL = body.url;
    console.log(imageURL);
    try {
        // Make an HTTP GET request using axios
        const response = await axios.get(imageURL);
        
        // Read the response body as bytes
        const imageBytes = response.data;
        
        // Write the image to a file
        const ext = getImageExtension(imageURL);
        const fileName = `/tmp/image_${await generateUUID()}.${ext}`;
        console.log(fileName);

        await fs.writeFile(fileName, imageBytes);


        if (!isSupportedFile(fileName)) {
            return false;
        }
        
        let output = await getTextFromImage(fileName);
        console.log(output);
        return { statusCode: 200, header: "Access-Control-Allow-Origin: *", body: output };
        
      } catch (error) {
        console.error(`Error reading image URL: ${imageURL}`, error);
        throw new Error(`Error reading image URL: ${error.message}`);
      }
    

  };
  
  module.exports = {
    handler,
  };