import { Runtime, Function, Code, CfnLayerVersion } from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import { App, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi, Cors } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Duration, DockerImage } from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import path = require('path');
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { BlockPublicAccess, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class Recipe3Stack extends Stack {
  constructor(app: App, id: string) {
    super(app, id);
    dotenv.config({ path: path.resolve(__dirname, '.env') });
    const openAiApiKey = process.env.OPEN_AI_API_KEY || 'NO_API_KEY';
    const privateKey = process.env.PRIVATE_KEY || 'NO_PRIVATE_KEY';
    const nftStoreApiKey = process.env.NFT_STORAGE_API_KEY || 'No NFT Store API Key';

    // Setup our dynamo db table
    const dynamoTable = new Table(this, 'Recipes', {
      partitionKey: {
        name: 'uuid',
        type: AttributeType.STRING
      },
      readCapacity: 1,
      writeCapacity: 1,
      tableName: 'Recipes',

      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      removalPolicy: RemovalPolicy.RETAIN, // NOT recommended for production code
    });


    // Lambda function to add a new recipe
    // Expects a string URL
    const s3Bucket = new s3.Bucket(this, 'RecipeImages', {
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      publicReadAccess: true,
    });

    const al2Layer = new lambda.LayerVersion(this, 'al2-layer', {
      // reference the directory containing the ready-to-use layer
      code: Code.fromAsset('lib/lambdas/tesseract-py/tesseract/amazonlinux-2'),
      description: 'AL2 Tesseract Layer',
    });
    // const pathToLayerSource = path.resolve(__dirname, '.');

    // const al2Layer = new lambda.LayerVersion(this, 'al2-layer', {
    //   code: Code.fromAsset(pathToLayerSource, {
    //     bundling: {
    //       image: DockerImage.fromBuild(pathToLayerSource, { file: 'Dockerfile' }),
    //       command: ['/bin/bash', '-c', 'cp -r /opt/build-dist/. /asset-output/'],
    //     },
    //   }),
    //   description: 'AL2 Tesseract Layer',
    // });
    // this.renameLogicalId(this.getLogicalId(al2Layer.node.defaultChild as CfnLayerVersion), 'al2layer');

    const addRecipeWorker = new Function(this, 'addRecipeWorker', {
      description: "Add recipes worker",
      code: Code.fromAsset('lib/lambdas/addRecipeWorker/target/x86_64-unknown-linux-musl/release/lambda'),
      runtime: Runtime.PROVIDED_AL2,
      handler: 'not.required',
      timeout: Duration.minutes(5),
      layers: [al2Layer],
      environment: {
        RUST_BACKTRACE: '1',
        TABLE_NAME: 'Recipes',
        OPEN_AI_API_KEY: openAiApiKey,
        BUCKET_NAME: s3Bucket.bucketName
      },
      logRetention: RetentionDays.ONE_WEEK
    });

    s3Bucket.grantWrite(addRecipeWorker);
    s3Bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutBucketPolicy'],
        resources: [s3Bucket.bucketArn],
        principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
      })
    );
    // Create an SNS topic and subscribe the addRecipeWorker Lambda function
    const recipeTopic = new sns.Topic(this, 'AddRecipeTopic');
    recipeTopic.addSubscription(new LambdaSubscription(addRecipeWorker));

    const addRecipe = new Function(this, 'addRecipe', {
      description: "Add recipes worker",
      code: Code.fromAsset('lib/lambdas/addRecipe/target/x86_64-unknown-linux-musl/release/lambda'),
      runtime: Runtime.PROVIDED_AL2,
      handler: 'not.required',
      timeout: Duration.minutes(5),
      environment: {
        RUST_BACKTRACE: '1',
        TABLE_NAME: 'Recipes',
        SNS_ARN: recipeTopic.topicArn
      },
      logRetention: RetentionDays.ONE_WEEK
    });

    recipeTopic.grantPublish(addRecipe);

    // Gets all recipes from dynamoDB
    const getRecipes = new Function(this, 'getRecipes', {
      description: "Add recipes",
      code: Code.fromAsset('lib/lambdas/getRecipes/target/x86_64-unknown-linux-musl/release/lambda'),
      runtime: Runtime.PROVIDED_AL2,
      handler: 'not.required',
      environment: {
        RUST_BACKTRACE: '1',
        TABLE_NAME: 'Recipes',
      },
      logRetention: RetentionDays.ONE_WEEK
    });

    // Lambda for minting a recipe
    const mintNFT = new Function(this, 'mintRecipe', {
      code: lambda.Code.fromAsset(path.join(__dirname, '/lambdas/mintRecipe')),
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler.handler',
      timeout: Duration.minutes(5),
      environment: {
        NFT_STORAGE_API_KEY: nftStoreApiKey,
        PRIVATE_KEY: privateKey,
      }
    });

    const tesseract = new lambda.Function(this, 'tesseract', {
      code: lambda.Code.fromAsset(path.join(__dirname, '/lambdas/tesseract-py')),
      runtime: Runtime.PYTHON_3_8,
      layers: [al2Layer],
      memorySize: 1024,
      timeout: Duration.seconds(10),
      handler: 'handler.main',
  });


    // Grant the lambda functions write and read access
    dynamoTable.grantFullAccess(getRecipes);
    dynamoTable.grantFullAccess(addRecipe);
    dynamoTable.grantFullAccess(addRecipeWorker);    

    // Create an API Gateway resource for each of the CRUD operations
    const api = new RestApi(this, 'Recipe3API', {
      restApiName: 'Recipe3 API',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS,
      }
    });

    const nftAPI = new RestApi(this, 'MintRecipe3API', {
      restApiName: "Mint Recipe3 API",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS
      }
    });

    const tesseractAPI = new RestApi(this, 'TesseractAPI', {
      restApiName: "Tesseract API",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS
      }
    });

    // Integrate lambda functions with an API gateway
    const mintNFTAPI = new LambdaIntegration(mintNFT);
    const getRecipesAPI = new LambdaIntegration(getRecipes);
    const addRecipeAPI = new LambdaIntegration(addRecipe);
    const tesseractAPIIntegration = new LambdaIntegration(tesseract);

    const tessy = tesseractAPI.root.addResource('api');
    tessy.addMethod('POST', tesseractAPIIntegration);

    const nfts = nftAPI.root.addResource('api');
    nfts.addMethod('POST', mintNFTAPI);

    const books = api.root.addResource('api');
    books.addMethod('POST', addRecipeAPI);
    books.addMethod('GET', getRecipesAPI);
  }
}

export function addCorsOptions(apiResource: IResource, httpMethod: string) {
  apiResource.addMethod(httpMethod, new MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  });
}

const app = new App();
new Recipe3Stack(app, 'Recipe3Stack');
app.synth();
