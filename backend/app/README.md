# Welcome to Recipe3's Backend

This is a CDK project so everything is serverless

## To build

- Run npm install && npm build
- Ensure you are signed into your AWS cli account
- Run cdk deploy

## Infrastructure

### Add Recipe

Add recipe is a simple Lambda function built using Rust that takes in either a recipe URL, a URL to an image of a recipe, or a bulk text of a recipe.

This value is then passed to an SNS message queue to be consumed by our recipe worker.

### Add Recipe Worker

This is where the magic happens. This is a subscriber to our SNS topic. We then take in the content and do one of the following to get the raw recipe contents:

- If it's a recipe URL => download and parse recipe from website metadata
- If it's an image URL => call our tesseract service to analyze the image and extract the raw text
- If it's already raw text => we just take this as is

Once we have the raw text, we use OpenAI's GPT-4 to parse the recipe into JSON format.

Once we have the recipe in JSON format, we take the description and using OpenAI's api's we generate an image of the recipe.

Finally, we upload the new recipe to DynamoDB

### Get Recipes

Gets all the recipes from DynamoDB

Also can get a single recipe which you can use to see if a recipe is done being created or not.

### Mint Recipe

This is a lambda function written in JavaScript (our only one) which mints the given recipe as a Polygon NFT and gives ownership to the public key passed in.
